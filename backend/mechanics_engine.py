"""
Soccer Biomechanics AI — Mechanics Engine

Pose extraction (MediaPipe Tasks API only), kinematic computation, dynamics estimation,
and injury risk assessment.

Uses only mediapipe.tasks.python.vision.PoseLandmarker. Do not use mp.solutions or
mp.solutions.pose — that API was removed in MediaPipe 0.10.x and causes AttributeError.

Do not add a file named mediapipe.py in this directory or any parent in the import path;
it would shadow the installed mediapipe package.

Coordinate scaling note: MediaPipe landmarks are normalized [0,1] relative to frame
width/height. All physical metrics are scaled to pixel space (x *= width, y *= height)
before differentiation so that velocities and torques are in consistent pixel-based units.
Divide by pixels-per-meter to get SI units if camera calibration is available.
"""

import urllib.request
from pathlib import Path
from typing import Any, List, Optional

import cv2
import numpy as np
from scipy.signal import savgol_filter

# MediaPipe Tasks API only (no mp.solutions)
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core import base_options
from mediapipe.tasks.python.vision.core.image import Image, ImageFormat

# ---------------------------------------------------------------------------
# Model setup
# ---------------------------------------------------------------------------

POSE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
_MODEL_DIR = Path(__file__).resolve().parent / "models"
_MODEL_PATH = _MODEL_DIR / "pose_landmarker_lite.task"


def _ensure_pose_model() -> Path:
    """Download pose landmarker model if missing; return path to .task file."""
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if _MODEL_PATH.exists():
        return _MODEL_PATH
    urllib.request.urlretrieve(POSE_MODEL_URL, _MODEL_PATH)
    return _MODEL_PATH


# ---------------------------------------------------------------------------
# MediaPipe landmark indices
# ---------------------------------------------------------------------------

LEFT_HIP, RIGHT_HIP = 23, 24
LEFT_KNEE, RIGHT_KNEE = 25, 26
LEFT_ANKLE, RIGHT_ANKLE = 27, 28
LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12

# ---------------------------------------------------------------------------
# Physical / model constants
# ---------------------------------------------------------------------------

# Lower leg inertia about knee (thin-rod approx): I = (1/3) * m * L²
# m ≈ 4.5 kg, L ≈ 0.4 m → I ≈ 0.24 kg·m²
I_LOWER_LEG_KG_M2 = 0.25

# Savitzky-Golay filter
SGF_WINDOW = 7
SGF_POLY = 3

# Event detection thresholds
VELOCITY_SPIKE_THRESHOLD = 2.0
VELOCITY_SPIKE_MIN_PROMINENCE = 1.0
ACCELERATION_BURST_WEIGHT = 0.1

# Pixel-to-meter scale (estimated dynamically per video, fallback if unavailable)
# Based on avg lower leg length ~0.4m and typical pixel span in smartphone video
FALLBACK_PIXELS_PER_METER = 200.0

# ---------------------------------------------------------------------------
# Injury risk thresholds (athlete-facing, conservative/educational)
# ---------------------------------------------------------------------------

ACL_TORQUE_ASYMMETRY_PCT_THRESHOLD = 20.0
# Running knee angles stay above 40° at peak extension — below 40° means deep squat/landing
ACL_LOW_KNEE_ANGLE_THRESHOLD = 40.0

HAMSTRING_HIGH_EXTENSION_DEG = 165.0  # true near-full extension (not normal running range)
HAMSTRING_ACCEL_THRESHOLD = 40.0      # rad/s² — realistic threshold for strain risk

OVERUSE_ASYMMETRY_PCT_THRESHOLD = 15.0

# Lateral acceleration thresholds in m/s² — converted to px/s² dynamically
AGILITY_ACCEL_MS2     = 8.0    # m/s²; typical aggressive cut
ANKLE_INSTABILITY_MS2 = 12.0   # m/s²; high lateral ankle stress


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _knee_angle_deg(hip_xy: np.ndarray, knee_xy: np.ndarray, ankle_xy: np.ndarray) -> float:
    """
    Knee flexion angle (degrees) using Law of Cosines.
    Vectors: upper = hip→knee, lower = ankle→knee.
    """
    a = hip_xy - knee_xy
    b = ankle_xy - knee_xy
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return float("nan")
    cos_theta = np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_theta)))


def _numerical_derivative(y: np.ndarray, t_ms: np.ndarray) -> np.ndarray:
    """
    dy/dt via central differences (forward/backward at boundaries).
    t_ms in milliseconds; returns derivative in y-units per second.
    """
    n = len(y)
    dydt = np.full(n, np.nan, dtype=float)
    for i in range(n):
        if i == 0:
            dt_s = (t_ms[1] - t_ms[0]) / 1000.0 if n > 1 else 0.0
            dydt[i] = (y[1] - y[0]) / dt_s if dt_s > 0 else 0.0
        elif i == n - 1:
            dt_s = (t_ms[i] - t_ms[i - 1]) / 1000.0
            dydt[i] = (y[i] - y[i - 1]) / dt_s if dt_s > 0 else 0.0
        else:
            dt_s = (t_ms[i + 1] - t_ms[i - 1]) / 1000.0
            dydt[i] = (y[i + 1] - y[i - 1]) / dt_s if dt_s > 0 else 0.0
    return dydt


def _savgol_smooth(x: np.ndarray, window: int = SGF_WINDOW, poly: int = SGF_POLY) -> np.ndarray:
    """
    Savitzky-Golay smoothing. Falls back to input if array too short.
    Much better than moving average for biomechanics: preserves peak shape.
    """
    n = len(x)
    if n < window:
        return x.copy()
    # window must be odd
    w = window if window % 2 == 1 else window + 1
    w = min(w, n if n % 2 == 1 else n - 1)
    try:
        return savgol_filter(x, window_length=w, polyorder=min(poly, w - 1))
    except Exception:
        return x.copy()


def _to_list(arr: np.ndarray, round_d: int = 6) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for x in arr:
        try:
            out.append(None if np.isnan(x) else round(float(x), round_d))
        except (TypeError, ValueError):
            out.append(None)
    return out


def _get_lm(lms: list, idx: int, key: str, fallback: float = 0.0) -> float:
    if len(lms) > idx:
        return float(lms[idx].get(key, fallback))
    return fallback


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _pose_bbox(landmarks: list, width: int, height: int) -> tuple[float, float, float, float]:
    """
    Bounding box (x_min, y_min, x_max, y_max) in pixel coords for a pose,
    using only high-visibility landmarks.
    """
    xs = [lm.x * width  for lm in landmarks if (lm.visibility or 0) > 0.3]
    ys = [lm.y * height for lm in landmarks if (lm.visibility or 0) > 0.3]
    if not xs or not ys:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(xs), min(ys), max(xs), max(ys))


def _bbox_area(bbox: tuple) -> float:
    x0, y0, x1, y1 = bbox
    return max(0.0, x1 - x0) * max(0.0, y1 - y0)


def _bbox_center(bbox: tuple) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    return ((x0 + x1) / 2.0, (y0 + y1) / 2.0)


def _bbox_iou(a: tuple, b: tuple) -> float:
    """Intersection-over-union for two bboxes — used for person tracking."""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    union = _bbox_area(a) + _bbox_area(b) - inter
    return inter / union if union > 0 else 0.0


def extract_pose(video_path: str, target_x: Optional[float] = None) -> dict[str, Any]:
    """
    Extract 2D joint coordinates (landmarks) for every frame using MediaPipe
    Pose Landmarker (Tasks API).

    Multi-person aware: detects up to 4 people per frame and locks onto the
    primary athlete using a two-stage strategy:
      1. Initialization (first 10 frames): pick the person with the largest
         bounding box (closest to camera). If target_x is provided (0=left,
         1=right), prefer the person whose center is closest to that x position.
      2. Tracking: in subsequent frames, match to the locked person using IoU.

    Returns structured dict with metadata and frames: list of {timestamp_ms, landmarks}.
    Landmarks are 33 body keypoints with x, y (pixel-scaled), z (normalized depth),
    and visibility. Safe for JSON serialization.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"metadata": {"error": "Could not open video"}, "frames": []}

    fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or 1)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1)

    model_path = _ensure_pose_model()
    opts = base_options.BaseOptions(model_asset_path=str(model_path))
    options = vision.PoseLandmarkerOptions(
        base_options=opts,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=4,                          # detect up to 4 people
        min_pose_detection_confidence=0.4,    # slightly lower for crowded scenes
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    landmarker = vision.PoseLandmarker.create_from_options(options)

    frames_out: list[dict[str, Any]] = []
    frame_index   = 0
    INIT_FRAMES   = 10                 # frames used to establish dominant person
    IOU_THRESHOLD = 0.25               # min IoU to count as same person

    # Mutable tracking state (use list as container to allow mutation inside nested fn)
    track: dict = {"locked_bbox": None, "init_votes": []}

    def select_pose_index(pose_landmarks_list: list, width: int, height: int) -> int:
        """Return index of the pose that best matches our locked athlete."""
        if not pose_landmarks_list:
            return 0
        bboxes = [_pose_bbox(p, width, height) for p in pose_landmarks_list]
        locked = track["locked_bbox"]

        # During init: if target_x provided, pick person closest to that x position
        if locked is None:
            if target_x is not None:
                target_px = target_x * width
                centers = [_bbox_center(b)[0] for b in bboxes]
                return int(np.argmin([abs(c - target_px) for c in centers]))
            # Otherwise pick largest bbox
            areas = [_bbox_area(b) for b in bboxes]
            return int(np.argmax(areas))

        # After init: prefer highest IoU with locked bbox
        ious = [_bbox_iou(locked, b) for b in bboxes]
        best_iou = max(ious)
        if best_iou >= IOU_THRESHOLD:
            return int(np.argmax(ious))

        # Fallback: largest bbox
        areas = [_bbox_area(b) for b in bboxes]
        return int(np.argmax(areas))

    try:
        while True:
            success, frame = cap.read()
            if not success:
                break

            timestamp_ms = int((frame_index / fps) * 1000.0)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            if not frame_rgb.flags["C_CONTIGUOUS"]:
                frame_rgb = np.ascontiguousarray(frame_rgb)

            mp_image = Image(ImageFormat.SRGB, frame_rgb)
            result   = landmarker.detect_for_video(mp_image, timestamp_ms)

            landmarks_list: list[dict[str, float]] = []

            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                chosen_idx = select_pose_index(result.pose_landmarks, width, height)
                chosen     = result.pose_landmarks[chosen_idx]
                chosen_bbox = _pose_bbox(chosen, width, height)

                # During init phase, record bboxes to lock onto dominant person
                if frame_index < INIT_FRAMES:
                    track["init_votes"].append(chosen_bbox)
                    if frame_index == INIT_FRAMES - 1:
                        votes = track["init_votes"]
                        track["locked_bbox"] = (
                            float(np.median([b[0] for b in votes])),
                            float(np.median([b[1] for b in votes])),
                            float(np.median([b[2] for b in votes])),
                            float(np.median([b[3] for b in votes])),
                        )
                else:
                    # Update locked bbox with EMA smoothing
                    if track["locked_bbox"] is not None:
                        lb    = track["locked_bbox"]
                        alpha = 0.3
                        track["locked_bbox"] = (
                            lb[0] * (1 - alpha) + chosen_bbox[0] * alpha,
                            lb[1] * (1 - alpha) + chosen_bbox[1] * alpha,
                            lb[2] * (1 - alpha) + chosen_bbox[2] * alpha,
                            lb[3] * (1 - alpha) + chosen_bbox[3] * alpha,
                        )

                # Build landmark list in pixel space
                for lm in chosen:
                    landmarks_list.append({
                        "x": round(float(lm.x) * width,  2),
                        "y": round(float(lm.y) * height, 2),
                        "z": round(float(lm.z), 6),
                        "visibility": round(float(lm.visibility or 1.0), 4),
                    })

                # Expose which person index was chosen (useful for debugging)
                chosen_person_idx = chosen_idx
            else:
                landmarks_list    = [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0}] * 33
                chosen_person_idx = -1

            frames_out.append({
                "frame_index":    frame_index,
                "timestamp_ms":   round((frame_index / fps) * 1000.0, 2),
                "landmarks":      landmarks_list,
                "person_index":   chosen_person_idx,
            })
            frame_index += 1
    finally:
        cap.release()
        landmarker.close()

    return {
        "metadata": {
            "fps":              round(fps, 2),
            "frame_count":      frame_index,
            "width":            width,
            "height":           height,
            "coordinate_space": "pixels",
            "tracking":         "largest_bbox_with_iou_lock",
        },
        "frames": frames_out,
    }


def compute_kinematics(
    pose_data: dict[str, Any],
    height_cm: Optional[float] = None,
    weight_kg: Optional[float] = None,
) -> dict[str, Any]:
    """
    Compute knee/hip angles, angular velocity, angular acceleration, and torque estimates.
    Smoothed with Savitzky-Golay filter.

    Args:
        pose_data:  Output from extract_pose().
        height_cm:  Athlete height in cm (improves px/m calibration).
        weight_kg:  Athlete weight in kg (improves torque/power accuracy).
    """
    frames = pose_data.get("frames", [])
    meta = pose_data.get("metadata", {})
    empty = {
        "metadata": meta,
        "timestamp_ms": [],
        "left_knee_angle_deg": [], "right_knee_angle_deg": [],
        "left_knee_angular_velocity_rad_s": [], "right_knee_angular_velocity_rad_s": [],
        "left_knee_angular_acceleration_rad_s2": [], "right_knee_angular_acceleration_rad_s2": [],
        "left_knee_peak_torque_nm": [], "right_knee_peak_torque_nm": [],
        "ankle_speed_ms": [], "ankle_lateral_acceleration": [],
        "left_hip_angle_deg": [], "right_hip_angle_deg": [],
        "torque_asymmetry_pct": [],
        "px_per_m": FALLBACK_PIXELS_PER_METER,
    }
    if not frames:
        return empty

    n = len(frames)
    t_ms = np.array([f["timestamp_ms"] for f in frames], dtype=float)

    # ---- Knee angles ----
    left_knee_deg = np.zeros(n)
    right_knee_deg = np.zeros(n)
    # ---- Hip angles (shoulder-hip-knee) ----
    left_hip_deg = np.zeros(n)
    right_hip_deg = np.zeros(n)

    for i, fr in enumerate(frames):
        lms = fr.get("landmarks", [])
        if len(lms) < 29:
            left_knee_deg[i] = right_knee_deg[i] = np.nan
            left_hip_deg[i] = right_hip_deg[i] = np.nan
            continue

        def lm(idx: int) -> np.ndarray:
            return np.array([lms[idx]["x"], lms[idx]["y"]], dtype=float)

        def vis(idx: int) -> float:
            return float(lms[idx].get("visibility", 0)) if len(lms) > idx else 0.0

        # Only compute angle if all 3 landmarks are visible enough
        MIN_VIS = 0.4
        if vis(LEFT_HIP) > MIN_VIS and vis(LEFT_KNEE) > MIN_VIS and vis(LEFT_ANKLE) > MIN_VIS:
            left_knee_deg[i] = _knee_angle_deg(lm(LEFT_HIP), lm(LEFT_KNEE), lm(LEFT_ANKLE))
        else:
            left_knee_deg[i] = np.nan

        if vis(RIGHT_HIP) > MIN_VIS and vis(RIGHT_KNEE) > MIN_VIS and vis(RIGHT_ANKLE) > MIN_VIS:
            right_knee_deg[i] = _knee_angle_deg(lm(RIGHT_HIP), lm(RIGHT_KNEE), lm(RIGHT_ANKLE))
        else:
            right_knee_deg[i] = np.nan

        if vis(LEFT_SHOULDER) > MIN_VIS and vis(LEFT_HIP) > MIN_VIS and vis(LEFT_KNEE) > MIN_VIS:
            left_hip_deg[i] = _knee_angle_deg(lm(LEFT_SHOULDER), lm(LEFT_HIP), lm(LEFT_KNEE))
        else:
            left_hip_deg[i] = np.nan

        if vis(RIGHT_SHOULDER) > MIN_VIS and vis(RIGHT_HIP) > MIN_VIS and vis(RIGHT_KNEE) > MIN_VIS:
            right_hip_deg[i] = _knee_angle_deg(lm(RIGHT_SHOULDER), lm(RIGHT_HIP), lm(RIGHT_KNEE))
        else:
            right_hip_deg[i] = np.nan

    def _clean_angles(angles: np.ndarray, max_jump_deg: float = 30.0) -> np.ndarray:
        """Remove single-frame angle spikes caused by tracking errors."""
        cleaned = angles.copy()
        for i in range(1, len(cleaned) - 1):
            if np.isnan(cleaned[i]):
                continue
            prev_ok = not np.isnan(cleaned[i-1])
            next_ok = not np.isnan(cleaned[i+1])
            if prev_ok and next_ok:
                if abs(cleaned[i] - cleaned[i-1]) > max_jump_deg and abs(cleaned[i+1] - cleaned[i]) > max_jump_deg:
                    cleaned[i] = (cleaned[i-1] + cleaned[i+1]) / 2.0
        return cleaned

    # ---- Convert angles to radians for derivatives ----
    left_knee_deg  = _clean_angles(left_knee_deg)
    right_knee_deg = _clean_angles(right_knee_deg)
    left_knee_rad  = np.radians(np.nan_to_num(left_knee_deg,  nan=0.0))
    right_knee_rad = np.radians(np.nan_to_num(right_knee_deg, nan=0.0))

    # ---- Angular velocity (rad/s) — clamp to realistic max (~25 rad/s for elite kick) ----
    left_omega  = np.clip(_savgol_smooth(_numerical_derivative(left_knee_rad,  t_ms)), -25.0, 25.0)
    right_omega = np.clip(_savgol_smooth(_numerical_derivative(right_knee_rad, t_ms)), -25.0, 25.0)

    # ---- Angular acceleration (rad/s²) — clamp to realistic max (~100 rad/s²) ----
    left_alpha  = np.clip(_savgol_smooth(_numerical_derivative(left_omega,  t_ms)), -100.0, 100.0)
    right_alpha = np.clip(_savgol_smooth(_numerical_derivative(right_omega, t_ms)), -100.0, 100.0)

    # ---- Angular jerk for refined torque ----
    left_jerk  = _savgol_smooth(_numerical_derivative(left_alpha,  t_ms))
    right_jerk = _savgol_smooth(_numerical_derivative(right_alpha, t_ms))

    # ---- Lower leg inertia — use weight if provided ----
    # I = (1/3) * m_leg * L²;  lower leg ≈ 6.1% of body weight, L ≈ 0.4m
    LOWER_LEG_M = 0.40
    if weight_kg and weight_kg > 0:
        m_lower_leg = weight_kg * 0.061
        I_knee = (1.0 / 3.0) * m_lower_leg * (LOWER_LEG_M ** 2)
    else:
        I_knee = I_LOWER_LEG_KG_M2

    left_torque  = I_knee * (left_alpha  + ACCELERATION_BURST_WEIGHT * left_jerk)
    right_torque = I_knee * (right_alpha + ACCELERATION_BURST_WEIGHT * right_jerk)

    # ---- Torque asymmetry per frame ----
    # Only meaningful when BOTH legs have valid angle data
    torque_abs_l = np.abs(left_torque)
    torque_abs_r = np.abs(right_torque)
    torque_sum   = torque_abs_l + torque_abs_r

    # Mask frames where either knee angle was NaN (occluded) — these give fake asymmetry
    both_valid = ~np.isnan(left_knee_deg) & ~np.isnan(right_knee_deg)

    with np.errstate(divide="ignore", invalid="ignore"):
        raw_asym = np.where(
            torque_sum > 1e-9,
            np.abs(torque_abs_l - torque_abs_r) / np.where(torque_sum > 1e-9, torque_sum / 2.0, 1.0) * 100.0,
            0.0,
        )
    # Zero out asymmetry on frames with missing data, clamp to [0,100]
    torque_asym_pct = np.clip(np.where(both_valid, raw_asym, 0.0), 0.0, 100.0)

    # ---- Estimate pixels-per-meter ----
    # Priority: (1) athlete height if provided, (2) lower leg segment measurement

    if height_cm and height_cm > 0:
        # Use hip-to-ankle as ~53% of height (anthropometric ratio)
        height_m = height_cm / 100.0
        hip_ankle_m = height_m * 0.53
        hip_ankle_lengths: List[float] = []
        for fr in frames:
            lms = fr.get("landmarks", [])
            if len(lms) > max(LEFT_HIP, LEFT_ANKLE, RIGHT_HIP, RIGHT_ANKLE):
                for h, a in [(LEFT_HIP, LEFT_ANKLE), (RIGHT_HIP, RIGHT_ANKLE)]:
                    vis_h = lms[h].get("visibility", 0)
                    vis_a = lms[a].get("visibility", 0)
                    if vis_h > 0.5 and vis_a > 0.5:
                        dx = lms[h]["x"] - lms[a]["x"]
                        dy = lms[h]["y"] - lms[a]["y"]
                        length_px = float(np.sqrt(dx**2 + dy**2))
                        if length_px > 10:
                            hip_ankle_lengths.append(length_px)
        if hip_ankle_lengths:
            px_per_m = float(np.median(hip_ankle_lengths)) / hip_ankle_m
        else:
            px_per_m = FALLBACK_PIXELS_PER_METER
        calibration_method = f"height_{height_cm:.0f}cm"
    else:
        # Fall back to knee-ankle segment
        knee_ankle_lengths: List[float] = []
        for fr in frames:
            lms = fr.get("landmarks", [])
            if len(lms) > max(LEFT_KNEE, LEFT_ANKLE, RIGHT_KNEE, RIGHT_ANKLE):
                for k, a in [(LEFT_KNEE, LEFT_ANKLE), (RIGHT_KNEE, RIGHT_ANKLE)]:
                    vis_k = lms[k].get("visibility", 0)
                    vis_a = lms[a].get("visibility", 0)
                    if vis_k > 0.5 and vis_a > 0.5:
                        dx = lms[k]["x"] - lms[a]["x"]
                        dy = lms[k]["y"] - lms[a]["y"]
                        length_px = float(np.sqrt(dx**2 + dy**2))
                        if length_px > 10:
                            knee_ankle_lengths.append(length_px)
        if knee_ankle_lengths:
            px_per_m = float(np.median(knee_ankle_lengths)) / LOWER_LEG_M
        else:
            px_per_m = FALLBACK_PIXELS_PER_METER
        calibration_method = "lower_leg_segment"

    # ---- Ankle kinematics (px/s → m/s) ----
    def lm_series(idx: int, key: str) -> np.ndarray:
        return np.array([_get_lm(f.get("landmarks", []), idx, key) for f in frames])

    def _clean_positions(pos: np.ndarray, max_jump_px: float = 0.0) -> np.ndarray:
        """
        Replace single-frame tracking jumps with interpolated values.
        max_jump_px defaults to 8% of the larger video dimension if not set.
        """
        if max_jump_px <= 0:
            vid_w = meta.get("width", 640)
            vid_h = meta.get("height", 480)
            max_jump_px = max(vid_w, vid_h) * 0.06  # 6% of frame dimension
        cleaned = pos.copy()
        for i in range(1, len(cleaned) - 1):
            prev_jump = abs(cleaned[i] - cleaned[i - 1])
            next_jump = abs(cleaned[i + 1] - cleaned[i])
            if prev_jump > max_jump_px and next_jump > max_jump_px:
                cleaned[i] = (cleaned[i - 1] + cleaned[i + 1]) / 2.0
        return cleaned

    # Max realistic ankle speed: ~12 m/s (elite sprint); training drills rarely exceed 8
    MAX_ANKLE_SPEED_MS = 12.0

    left_ankle_x  = _clean_positions(lm_series(LEFT_ANKLE,  "x"))
    right_ankle_x = _clean_positions(lm_series(RIGHT_ANKLE, "x"))
    left_ankle_y  = _clean_positions(lm_series(LEFT_ANKLE,  "y"))
    right_ankle_y = _clean_positions(lm_series(RIGHT_ANKLE, "y"))

    # Velocities in px/s → m/s, then smooth
    left_ankle_vx  = _savgol_smooth(_numerical_derivative(left_ankle_x,  t_ms)) / px_per_m
    right_ankle_vx = _savgol_smooth(_numerical_derivative(right_ankle_x, t_ms)) / px_per_m
    left_ankle_vy  = _savgol_smooth(_numerical_derivative(left_ankle_y,  t_ms)) / px_per_m
    right_ankle_vy = _savgol_smooth(_numerical_derivative(right_ankle_y, t_ms)) / px_per_m

    # Speed = max of both feet (m/s), clamped to realistic range
    raw_speed = np.maximum(
        np.sqrt(left_ankle_vx**2  + left_ankle_vy**2),
        np.sqrt(right_ankle_vx**2 + right_ankle_vy**2),
    )
    ankle_speed_ms = np.clip(_savgol_smooth(raw_speed), 0.0, MAX_ANKLE_SPEED_MS)

    # Lateral (y-direction) acceleration in m/s², clamped to realistic range
    left_ankle_ay   = _savgol_smooth(_numerical_derivative(left_ankle_vy,  t_ms))
    right_ankle_ay  = _savgol_smooth(_numerical_derivative(right_ankle_vy, t_ms))
    ankle_ay_smooth = np.clip(
        _savgol_smooth(np.maximum(np.abs(left_ankle_ay), np.abs(right_ankle_ay))),
        0.0, 15.0,  # 15 m/s² is near the human physiological ceiling for lateral acceleration
    )

    # ---- Stride-frequency-based speed estimation ----
    # Much more accurate than pixel velocity — avoids 3D projection errors.
    # Method: detect stride peaks in knee angular velocity → measure stride period
    # → Speed = stride_length / stride_period
    # stride_length ≈ 1.14 × height (empirical average for running)
    # Falls back to pixel-based if stride detection fails or height not provided.

    def _estimate_stride_speed(
        omega: np.ndarray,
        t_ms_arr: np.ndarray,
        height_m: float,
        fps: float,
    ) -> tuple[float, float, List[int]]:
        """
        Returns (peak_speed_ms, mean_speed_ms, stride_peak_indices).
        Detects local maxima in |omega| above threshold, measures inter-peak periods.
        """
        abs_omega = np.abs(omega)
        min_peak_val  = 1.5   # rad/s minimum to count as a stride
        min_gap_frames = max(5, int(fps * 0.25))  # min 0.25s between peaks

        peaks: List[int] = []
        for i in range(1, len(abs_omega) - 1):
            if (abs_omega[i] > min_peak_val
                    and abs_omega[i] >= abs_omega[i-1]
                    and abs_omega[i] >= abs_omega[i+1]):
                if not peaks or (i - peaks[-1]) >= min_gap_frames:
                    peaks.append(i)

        if len(peaks) < 2:
            return 0.0, 0.0, peaks

        # Compute stride periods from consecutive same-leg peaks
        stride_length_m = height_m * 1.14
        speeds: List[float] = []
        for k in range(1, len(peaks)):
            dt_s = (t_ms_arr[peaks[k]] - t_ms_arr[peaks[k-1]]) / 1000.0
            if 0.2 < dt_s < 2.0:  # realistic stride period: 0.2-2.0s
                speeds.append(stride_length_m / dt_s)

        if not speeds:
            return 0.0, 0.0, peaks

        # Use 90th percentile as "peak" (avoids single outlier)
        peak_spd = float(np.percentile(speeds, 90))
        mean_spd = float(np.mean(speeds))
        return peak_spd, mean_spd, peaks

    fps_val = float(meta.get("fps", 30.0))
    height_m_val = (height_cm / 100.0) if height_cm else 1.70  # default 170cm

    left_peak, left_mean, left_stride_peaks   = _estimate_stride_speed(left_omega,  t_ms, height_m_val, fps_val)
    right_peak, right_mean, right_stride_peaks = _estimate_stride_speed(right_omega, t_ms, height_m_val, fps_val)

    # Use the better-detected leg (more stride peaks = more reliable)
    if len(left_stride_peaks) >= len(right_stride_peaks) and left_peak > 0:
        stride_peak_speed  = left_peak
        stride_mean_speed  = left_mean
        stride_peaks_used  = left_stride_peaks
        dominant_foot      = "left"
    elif right_peak > 0:
        stride_peak_speed  = right_peak
        stride_mean_speed  = right_mean
        stride_peaks_used  = right_stride_peaks
        dominant_foot      = "right"
    else:
        # Fallback to pixel-based if no strides detected
        stride_peak_speed = float(np.nanmax(ankle_speed_ms)) if len(ankle_speed_ms) > 0 else 0.0
        stride_mean_speed = float(np.nanmean(ankle_speed_ms)) if len(ankle_speed_ms) > 0 else 0.0
        stride_peaks_used = []
        dominant_foot     = "unknown"

    # Clamp to realistic human speed range
    stride_peak_speed = float(np.clip(stride_peak_speed, 0.0, 11.0))  # 11 m/s = world-class sprint
    stride_mean_speed = float(np.clip(stride_mean_speed, 0.0, 11.0))

    # Map stride peak indices to timestamps for highlights
    peak_speed_ts_ms = float(t_ms[stride_peaks_used[0]]) if stride_peaks_used else float(t_ms[0])

    # Build stride speed series (for chart — smooth constant between peaks)
    stride_speed_series = np.zeros(n)
    if len(stride_peaks_used) >= 2:
        for k in range(1, len(stride_peaks_used)):
            i0, i1 = stride_peaks_used[k-1], stride_peaks_used[k]
            dt_s = (t_ms[i1] - t_ms[i0]) / 1000.0
            if 0.2 < dt_s < 2.0:
                spd = float(np.clip(height_m_val * 1.14 / dt_s, 0, 11.0))
                stride_speed_series[i0:i1] = spd
        # Fill last segment
        if stride_peaks_used:
            stride_speed_series[stride_peaks_used[-1]:] = stride_speed_series[stride_peaks_used[-1]-1]
    stride_speed_smooth = _savgol_smooth(stride_speed_series)

    return {
        "metadata": {
            **meta,
            "smooth_method": "savitzky_golay",
            "sgf_window": SGF_WINDOW,
            "px_per_m": round(px_per_m, 2),
            "calibration_method": calibration_method,
            "lower_leg_inertia_kg_m2": round(I_knee, 4),
            "athlete_height_cm": height_cm,
            "athlete_weight_kg": weight_kg,
            "peak_speed_ms":      round(stride_peak_speed, 2),
            "mean_speed_ms":      round(stride_mean_speed, 2),
            "peak_speed_timestamp_ms": round(peak_speed_ts_ms, 2),
            "speed_method":       "stride_frequency" if stride_peaks_used else "pixel_velocity",
            "stride_count":       len(stride_peaks_used),
            "dominant_foot":      dominant_foot,
        },
        "timestamp_ms": _to_list(t_ms, 2),
        "left_knee_angle_deg":  _to_list(left_knee_deg),
        "right_knee_angle_deg": _to_list(right_knee_deg),
        "left_hip_angle_deg":   _to_list(left_hip_deg),
        "right_hip_angle_deg":  _to_list(right_hip_deg),
        "left_knee_angular_velocity_rad_s":      _to_list(left_omega),
        "right_knee_angular_velocity_rad_s":     _to_list(right_omega),
        "left_knee_angular_acceleration_rad_s2": _to_list(left_alpha),
        "right_knee_angular_acceleration_rad_s2":_to_list(right_alpha),
        "left_knee_peak_torque_nm":  _to_list(left_torque),
        "right_knee_peak_torque_nm": _to_list(right_torque),
        "ankle_speed_ms":            _to_list(stride_speed_smooth, 3),  # stride-based m/s
        "ankle_lateral_acceleration":_to_list(ankle_ay_smooth, 4),       # m/s²
        "torque_asymmetry_pct":      _to_list(torque_asym_pct, 2),
        "px_per_m":                  round(px_per_m, 2),
    }


def detect_critical_events(kinematics: dict[str, Any]) -> dict[str, Any]:
    """
    Identify stride events, direction changes, and performance highlights.
    All speed/acceleration values in SI units (m/s, m/s², rad/s).
    """
    t_ms        = np.array(kinematics.get("timestamp_ms", []), dtype=float)
    left_omega  = np.array([v if v is not None else 0.0 for v in kinematics.get("left_knee_angular_velocity_rad_s", [])])
    right_omega = np.array([v if v is not None else 0.0 for v in kinematics.get("right_knee_angular_velocity_rad_s", [])])
    left_torque = np.array([v if v is not None else 0.0 for v in kinematics.get("left_knee_peak_torque_nm", [])])
    right_torque= np.array([v if v is not None else 0.0 for v in kinematics.get("right_knee_peak_torque_nm", [])])
    ankle_speed = np.array([v if v is not None else 0.0 for v in kinematics.get("ankle_speed_ms", [])])
    ankle_ay    = np.array([v if v is not None else 0.0 for v in kinematics.get("ankle_lateral_acceleration", [])])

    if len(t_ms) < 3:
        return {"critical_events": [], "velocity_spike_timestamps_ms": [], "performance_highlights": {}}

    # Stride events: peaks in knee angular velocity (each stride cycle)
    omega_abs = np.maximum(np.abs(left_omega), np.abs(right_omega))
    spike_indices: List[int] = []
    for i in range(1, len(omega_abs) - 1):
        if (omega_abs[i] >= VELOCITY_SPIKE_THRESHOLD
                and omega_abs[i] >= omega_abs[i - 1]
                and omega_abs[i] >= omega_abs[i + 1]
                and omega_abs[i] - np.nanmin(omega_abs[max(0, i - 5):i + 6]) >= VELOCITY_SPIKE_MIN_PROMINENCE):
            spike_indices.append(i)

    deduped: List[int] = []
    for idx in spike_indices:
        if not deduped or (t_ms[idx] - t_ms[deduped[-1]]) > 200:
            deduped.append(idx)

    # Direction change events: lateral acceleration spikes in m/s²
    agility_threshold_ms2 = AGILITY_ACCEL_MS2
    agility_indices: List[int] = []
    for i in range(1, len(ankle_ay) - 1):
        if (ankle_ay[i] >= agility_threshold_ms2
                and ankle_ay[i] >= ankle_ay[i - 1]
                and ankle_ay[i] >= ankle_ay[i + 1]):
            agility_indices.append(i)
    agility_deduped: List[int] = []
    for idx in agility_indices:
        if not agility_deduped or (t_ms[idx] - t_ms[agility_deduped[-1]]) > 300:
            agility_deduped.append(idx)

    critical_events: List[dict[str, Any]] = []
    for idx in deduped:
        critical_events.append({
            "event": "Stride Peak detected",
            "timestamp_ms": round(float(t_ms[idx]), 2),
            "timestamp_s":  round(float(t_ms[idx]) / 1000.0, 2),
            "angular_velocity_rad_s": round(float(omega_abs[idx]), 4),
        })
    for idx in agility_deduped:
        critical_events.append({
            "event": "Direction Change detected",
            "timestamp_ms": round(float(t_ms[idx]), 2),
            "timestamp_s":  round(float(t_ms[idx]) / 1000.0, 2),
            "lateral_acceleration_ms2": round(float(ankle_ay[idx]), 3),
        })

    torque_abs = np.maximum(np.abs(left_torque), np.abs(right_torque))

    # ---- Strongest sprint: find pair of consecutive stride peaks with shortest period ----
    # This gives a real timestamp where the athlete was moving fastest
    best_sprint_idx = 0
    best_sprint_speed = 0.0
    if len(deduped) >= 2:
        for k in range(1, len(deduped)):
            i0, i1 = deduped[k-1], deduped[k]
            dt_s = (t_ms[i1] - t_ms[i0]) / 1000.0
            if 0.2 < dt_s < 2.0:
                spd = 1.0 / dt_s  # proportional to speed (stride_length constant)
                if spd > best_sprint_speed:
                    best_sprint_speed = spd
                    best_sprint_idx = i0  # timestamp at start of fastest stride

    # ---- Peak stride power: highest torque at a stride peak ----
    best_power_idx = int(np.nanargmax(torque_abs)) if len(torque_abs) > 0 else 0
    # Prefer a stride peak moment over a random frame
    if deduped:
        stride_torques = [(torque_abs[i], i) for i in deduped if i < len(torque_abs)]
        if stride_torques:
            _, best_power_idx = max(stride_torques)

    # ---- Quickest turn: highest lateral acceleration ----
    max_agility_idx = int(np.nanargmax(ankle_ay)) if len(ankle_ay) > 0 else 0

    # Get actual speed from ankle_speed series at sprint index
    sprint_speed_val = float(ankle_speed[best_sprint_idx]) if len(ankle_speed) > best_sprint_idx else best_sprint_speed

    performance_highlights = {
        "peak_stride_power": {
            "timestamp_ms": round(float(t_ms[best_power_idx]), 2),
            "timestamp_s":  round(float(t_ms[best_power_idx]) / 1000.0, 2),
            "peak_torque_nm": round(float(torque_abs[best_power_idx]), 2),
        } if len(torque_abs) > 0 else None,
        "strongest_sprint": {
            "timestamp_ms": round(float(t_ms[best_sprint_idx]), 2),
            "timestamp_s":  round(float(t_ms[best_sprint_idx]) / 1000.0, 2),
            "peak_speed_ms": round(sprint_speed_val, 2),
        } if len(ankle_speed) > 0 else None,
        "quickest_turn": {
            "timestamp_ms": round(float(t_ms[max_agility_idx]), 2),
            "timestamp_s":  round(float(t_ms[max_agility_idx]) / 1000.0, 2),
            "lateral_acceleration_ms2": round(float(ankle_ay[max_agility_idx]), 3),
        } if len(ankle_ay) > 0 else None,
    }

    return {
        "critical_events": critical_events,
        "velocity_spike_timestamps_ms": [round(float(t_ms[i]), 2) for i in deduped],
        "performance_highlights": performance_highlights,
    }


def assess_injury_risk(kinematics: dict[str, Any]) -> dict[str, Any]:
    """
    Athlete-facing injury risk assessment derived from kinematic and torque data.

    Returns a structured risk profile with:
    - Per-risk-category: level (low/moderate/high), score (0-100), explanation,
      and actionable advice for the athlete.
    - Overall risk score and summary.

    NOTE: This is an estimation tool for educational/training awareness only.
    It is NOT a medical diagnosis. Athletes should consult a sports medicine
    professional for any injury concerns.
    """
    t_ms         = np.array(kinematics.get("timestamp_ms",                      []), dtype=float)
    left_knee    = np.array([v if v is not None else np.nan for v in kinematics.get("left_knee_angle_deg",               [])])
    right_knee   = np.array([v if v is not None else np.nan for v in kinematics.get("right_knee_angle_deg",              [])])
    left_alpha   = np.array([v if v is not None else np.nan for v in kinematics.get("left_knee_angular_acceleration_rad_s2",  [])])
    right_alpha  = np.array([v if v is not None else np.nan for v in kinematics.get("right_knee_angular_acceleration_rad_s2", [])])
    left_torque  = np.array([v if v is not None else np.nan for v in kinematics.get("left_knee_peak_torque_nm",          [])])
    right_torque = np.array([v if v is not None else np.nan for v in kinematics.get("right_knee_peak_torque_nm",         [])])
    ankle_ay     = np.array([v if v is not None else 0.0    for v in kinematics.get("ankle_lateral_acceleration",        [])])
    asym_pct     = np.array([v if v is not None else np.nan for v in kinematics.get("torque_asymmetry_pct",              [])])

    if len(t_ms) < 3:
        return _empty_risk_profile("Insufficient data for risk assessment.")

    # -----------------------------------------------------------------------
    # Data quality check
    # If too many frames have NaN angles (poor visibility), reduce confidence
    # -----------------------------------------------------------------------
    n_total = len(t_ms)
    left_valid  = np.sum(~np.isnan(left_knee))
    right_valid = np.sum(~np.isnan(right_knee))
    both_valid_frames = np.sum(~np.isnan(left_knee) & ~np.isnan(right_knee))
    data_quality = both_valid_frames / max(n_total, 1)  # 0.0 to 1.0

    # If less than 30% of frames have both legs visible, data is too noisy for reliable risk scoring
    if data_quality < 0.30:
        return _empty_risk_profile(
            f"Video quality insufficient for reliable injury risk assessment "
            f"({data_quality*100:.0f}% of frames had both legs visible). "
            f"For best results, film from the side at medium distance with the full body in frame."
        )

    # Only use frames where both legs are visible
    both_valid_mask = ~np.isnan(left_knee) & ~np.isnan(right_knee)

    # -----------------------------------------------------------------------
    # 1. ACL / Knee ligament risk
    #    Signal: sustained torque asymmetry (median, not peak) + deep flexion
    # -----------------------------------------------------------------------
    torque_abs_l = np.abs(np.nan_to_num(left_torque,  nan=0.0))
    torque_abs_r = np.abs(np.nan_to_num(right_torque, nan=0.0))
    torque_sum   = torque_abs_l + torque_abs_r

    # Use MEDIAN asymmetry on valid frames only — much more robust than peak
    valid_asym = asym_pct[both_valid_mask & ~np.isnan(asym_pct)]
    if len(valid_asym) > 0:
        median_asym = float(np.median(valid_asym))
        mean_asym   = float(np.mean(valid_asym))
    else:
        median_asym = mean_asym = 0.0

    # Deep flexion under high load — only on valid frames
    valid_left_knee  = left_knee[both_valid_mask]
    valid_right_knee = right_knee[both_valid_mask]
    valid_torque_sum = torque_sum[both_valid_mask]
    if len(valid_torque_sum) > 0:
        high_torque_mask = valid_torque_sum > np.nanpercentile(valid_torque_sum, 75)
        low_knee_mask    = (valid_left_knee < ACL_LOW_KNEE_ANGLE_THRESHOLD) | (valid_right_knee < ACL_LOW_KNEE_ANGLE_THRESHOLD)
        acl_risk_pct     = 100.0 * np.sum(high_torque_mask & low_knee_mask) / max(len(valid_torque_sum), 1)
    else:
        acl_risk_pct = 0.0

    # Score based on MEDIAN asymmetry (more stable) scaled by data quality
    acl_score = min(100.0, (
        acl_risk_pct * 0.5 +
        max(0.0, median_asym - ACL_TORQUE_ASYMMETRY_PCT_THRESHOLD) * 0.8
    ) * data_quality)
    acl_level = _risk_level(acl_score)

    acl_detail = {
        "risk_factor": "ACL / Knee Ligament Stress",
        "level": acl_level,
        "score": round(acl_score, 1),
        "key_signals": {
            "high_load_deep_flexion_frames_pct": round(acl_risk_pct, 1),
            "median_torque_asymmetry_pct": round(median_asym, 1),
            "mean_torque_asymmetry_pct": round(mean_asym, 1),
            "data_quality_pct": round(data_quality * 100, 1),
        },
        "what_this_means": (
            "ACL injuries often occur when the knee is deeply bent under high rotational load, "
            "especially when one leg is doing significantly more work than the other (asymmetry). "
            "Your data shows patterns consistent with this risk during certain movement frames."
        ),
        "athlete_advice": _acl_advice(acl_level, median_asym),
    }

    # -----------------------------------------------------------------------
    # 2. Hamstring strain risk
    #    Signal: high angular acceleration at or near full knee extension
    #    Use 95th percentile of acceleration (not peak) to avoid noise spikes
    # -----------------------------------------------------------------------
    near_full_extension = (
        (left_knee[both_valid_mask]  > HAMSTRING_HIGH_EXTENSION_DEG) |
        (right_knee[both_valid_mask] > HAMSTRING_HIGH_EXTENSION_DEG)
    ) if np.any(both_valid_mask) else np.array([], dtype=bool)

    valid_left_alpha  = np.abs(np.nan_to_num(left_alpha[both_valid_mask],  nan=0.0)) if np.any(both_valid_mask) else np.array([])
    valid_right_alpha = np.abs(np.nan_to_num(right_alpha[both_valid_mask], nan=0.0)) if np.any(both_valid_mask) else np.array([])
    combined_alpha    = np.maximum(valid_left_alpha, valid_right_alpha)

    # Use 95th percentile acceleration instead of peak to avoid noise
    p95_accel = float(np.percentile(combined_alpha, 95)) if len(combined_alpha) > 0 else 0.0

    if len(near_full_extension) > 0 and len(combined_alpha) > 0:
        high_accel_mask       = combined_alpha > HAMSTRING_ACCEL_THRESHOLD
        hamstring_risk_frames = np.sum(near_full_extension & high_accel_mask)
        hamstring_risk_pct    = 100.0 * hamstring_risk_frames / max(len(near_full_extension), 1)
    else:
        hamstring_risk_pct = 0.0

    hamstring_score = min(100.0, (
        hamstring_risk_pct * 0.8 +
        max(0.0, p95_accel - HAMSTRING_ACCEL_THRESHOLD) * 0.5
    ) * data_quality)
    hamstring_level = _risk_level(hamstring_score)

    hamstring_detail = {
        "risk_factor": "Hamstring Strain",
        "level": hamstring_level,
        "score": round(hamstring_score, 1),
        "key_signals": {
            "high_accel_near_extension_frames_pct": round(hamstring_risk_pct, 1),
            "p95_angular_acceleration_rad_s2": round(p95_accel, 2),
        },
        "what_this_means": (
            "Hamstring strains typically happen during explosive movements when the leg is "
            "nearly straight and decelerating rapidly — like the follow-through of a kick or "
            "the end of a sprint stride. High angular acceleration at full extension is the "
            "main warning signal."
        ),
        "athlete_advice": _hamstring_advice(hamstring_level, p95_accel),
    }

    # -----------------------------------------------------------------------
    # 3. Ankle instability risk
    #    Use median lateral acceleration (not peak) to avoid noise spikes
    # -----------------------------------------------------------------------
    p95_ankle_ay    = float(np.percentile(ankle_ay, 95)) if len(ankle_ay) > 0 else 0.0
    ankle_spikes    = np.sum(ankle_ay > ANKLE_INSTABILITY_MS2)
    ankle_spike_pct = 100.0 * ankle_spikes / max(len(t_ms), 1)

    ankle_score = min(100.0, (
        ankle_spike_pct * 0.5 +
        max(0.0, p95_ankle_ay - ANKLE_INSTABILITY_MS2) * 0.5
    ) * data_quality)
    ankle_level = _risk_level(ankle_score)

    ankle_detail = {
        "risk_factor": "Ankle Instability",
        "level": ankle_level,
        "score": round(ankle_score, 1),
        "key_signals": {
            "lateral_spike_frames_pct": round(ankle_spike_pct, 1),
            "p95_lateral_acceleration_ms2": round(p95_ankle_ay, 2),
        },
        "what_this_means": (
            "Sudden lateral ankle acceleration spikes during cuts and direction changes "
            "can indicate inversion stress — the same motion that causes ankle sprains. "
            "Frequent high-magnitude spikes suggest the ankle joint may be under repeated stress."
        ),
        "athlete_advice": _ankle_advice(ankle_level),
    }

    # -----------------------------------------------------------------------
    # 4. Overuse / compensation risk — use median asymmetry on valid frames
    # -----------------------------------------------------------------------
    # Use median asymmetry on valid frames only
    mean_global_asym   = float(np.mean(valid_asym))   if len(valid_asym) > 0 else 0.0
    median_global_asym = float(np.median(valid_asym)) if len(valid_asym) > 0 else 0.0

    overuse_score = min(100.0, max(0.0, median_global_asym - OVERUSE_ASYMMETRY_PCT_THRESHOLD) * 1.0 * data_quality)
    overuse_level = _risk_level(overuse_score)

    dominant_side = "left" if float(np.nanmean(torque_abs_l)) > float(np.nanmean(torque_abs_r)) else "right"

    overuse_detail = {
        "risk_factor": "Overuse / Compensation Pattern",
        "level": overuse_level,
        "score": round(overuse_score, 1),
        "key_signals": {
            "median_torque_asymmetry_pct": round(median_global_asym, 1),
            "dominant_side": dominant_side,
            "data_quality_pct": round(data_quality * 100, 1),
        },
        "what_this_means": (
            "When one leg consistently generates more torque than the other over time, "
            "the dominant side accumulates more stress. The non-dominant side may also be "
            "compensating with altered mechanics, increasing injury risk in both legs over time."
        ),
        "athlete_advice": _overuse_advice(overuse_level, dominant_side),
    }

    # -----------------------------------------------------------------------
    # Overall summary
    # -----------------------------------------------------------------------
    all_scores = [acl_score, hamstring_score, ankle_score, overuse_score]
    overall_score = round(float(np.mean(all_scores)), 1)
    overall_level = _risk_level(overall_score)

    highest_risk = max(
        [acl_detail, hamstring_detail, ankle_detail, overuse_detail],
        key=lambda d: d["score"]
    )

    return {
        "disclaimer": (
            "This is an estimation tool for educational and training awareness only. "
            "It is NOT a medical diagnosis. Consult a sports medicine professional "
            "for any injury concerns."
        ),
        "overall": {
            "level": overall_level,
            "score": overall_score,
            "summary": _overall_summary(overall_level, highest_risk["risk_factor"]),
        },
        "risk_categories": {
            "acl_knee": acl_detail,
            "hamstring": hamstring_detail,
            "ankle": ankle_detail,
            "overuse": overuse_detail,
        },
    }


# ---------------------------------------------------------------------------
# Injury risk helpers
# ---------------------------------------------------------------------------

def _risk_level(score: float) -> str:
    if score < 25:
        return "low"
    elif score < 55:
        return "moderate"
    else:
        return "high"


def _empty_risk_profile(reason: str) -> dict[str, Any]:
    return {
        "disclaimer": "This is an estimation tool for educational awareness only, not a medical diagnosis.",
        "overall": {"level": "unknown", "score": 0.0, "summary": reason},
        "risk_categories": {},
    }


def _overall_summary(level: str, top_risk: str) -> str:
    if level == "low":
        return "Your movement patterns show low overall injury risk. Keep focusing on balance and recovery."
    elif level == "moderate":
        return f"Moderate overall risk detected. Your highest concern is {top_risk}. Focus on the advice in that category."
    else:
        return f"Elevated overall risk detected. Priority area: {top_risk}. Review advice below and consider a sports medicine consultation."


def _acl_advice(level: str, asym_pct: float) -> str:
    if level == "low":
        return "Your knee loading appears balanced. Continue single-leg stability work to maintain this."
    elif level == "moderate":
        return (
            f"Your torque asymmetry ({asym_pct:.0f}%) suggests one knee is absorbing more stress. "
            "Add single-leg squat and lateral band work to even out leg strength. "
            "Focus on soft landings with knees tracking over toes."
        )
    else:
        return (
            f"Significant knee loading asymmetry detected ({asym_pct:.0f}%). "
            "Prioritize neuromuscular control training: single-leg landing drills, "
            "Nordic hamstring curls, and hip abductor strengthening. "
            "Consider a movement screen with a physio."
        )


def _hamstring_advice(level: str, peak_accel: float) -> str:
    if level == "low":
        return "Hamstring loading looks manageable. Maintain eccentric hamstring work as prevention."
    elif level == "moderate":
        return (
            "Some frames show rapid deceleration near full extension. "
            "Add Nordic curls and progressive sprint mechanics work. "
            "Warm up thoroughly before explosive activities."
        )
    else:
        return (
            f"High angular acceleration at extension detected ({peak_accel:.1f} rad/s²). "
            "This is the primary mechanism of hamstring strain. "
            "Reduce sprint volume temporarily, add eccentric loading (Nordics, Romanian deadlifts), "
            "and focus on hip hinge mechanics. Do not ignore tightness after sessions."
        )


def _ankle_advice(level: str) -> str:
    if level == "low":
        return "Ankle stability looks good. Single-leg balance work will help maintain this."
    elif level == "moderate":
        return (
            "Some lateral ankle stress detected during direction changes. "
            "Single-leg balance training, ankle banding, and calf strengthening will help. "
            "Ensure footwear provides adequate lateral support."
        )
    else:
        return (
            "Repeated high lateral ankle stress detected. This pattern is associated with "
            "ankle sprain risk, especially on uneven surfaces. "
            "Add proprioception training (wobble board, single-leg landing), "
            "strengthen peroneals, and consider ankle taping during high-intensity sessions."
        )


def _overuse_advice(level: str, dominant_side: str) -> str:
    if level == "low":
        return "Movement load appears reasonably balanced between legs. Good symmetry."
    elif level == "moderate":
        return (
            f"Your {dominant_side} leg is generating more torque on average. "
            "Add unilateral strength work on the non-dominant side and "
            "consciously practice two-footed skills in training."
        )
    else:
        return (
            f"Strong dominance pattern detected ({dominant_side} side). "
            "Over time this increases overuse injury risk on the dominant side and "
            "compensation injuries on the other. Prioritize bilateral strength balance, "
            "reduce single-leg loading temporarily, and monitor for recurring soreness "
            "on the dominant side."
        )


def estimate_dynamics(kinematics: dict[str, Any]) -> dict[str, Any]:
    """
    Placeholder for full inverse dynamics layer (Phase 3+).
    Currently returns torque data already computed in compute_kinematics.
    """
    return {
        "note": "Full inverse dynamics (Phase 3). Torque estimates available in kinematics output.",
        "forces": [],
        "moments": [],
    }
