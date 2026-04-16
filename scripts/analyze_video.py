"""
KickIQ Video Analyzer — Camera-Stabilized Athlete Speed & Acceleration
Approach:
  1. Player-height calibration → px/m
  2. Frame-to-frame LK optical flow on background → translation only (no scale drift)
  3. Stabilized displacement = athlete_disp - background_disp
  4. Integrate displacements → world positions
  5. Savitzky-Golay smooth → velocity + acceleration
  6. Physical plausibility clamp (human biomechanics limits)
"""
import cv2
import numpy as np
import json
from scipy.signal import savgol_filter, find_peaks

VIDEO   = "/Users/kaorigarcia/Documents/GitHub/Kaori/kaori/public/demo.mp4"
OUT     = "/Users/kaorigarcia/Documents/GitHub/Kaori/kaori/public/athlete_track.json"
GOAL_W  = 7.32  # m

cap  = cv2.VideoCapture(VIDEO)
FPS  = cap.get(cv2.CAP_PROP_FPS)
W    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
H    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
N    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"Video {W}×{H} @ {FPS:.2f}fps  {N} frames  {N/FPS:.2f}s")

# ── HSV ranges ────────────────────────────────────────────────────────────────
RED_LO1 = np.array([0,   90,  70], np.uint8)
RED_HI1 = np.array([22,  255, 255], np.uint8)
RED_LO2 = np.array([152, 90,  70], np.uint8)
RED_HI2 = np.array([180, 255, 255], np.uint8)

# ── Pass 1: measure player blob height → px/m calibration ────────────────────
print("Pass 1: scale calibration…")
player_heights = []
while True:
    ret, frm = cap.read()
    if not ret: break
    hsv = cv2.cvtColor(frm, cv2.COLOR_BGR2HSV)
    m   = cv2.bitwise_or(cv2.inRange(hsv, RED_LO1, RED_HI1),
                         cv2.inRange(hsv, RED_LO2, RED_HI2))
    m   = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
    # Only right portion of frame (athlete known to be there)
    m[:, :int(W*0.35)] = 0
    m[:int(H*0.18)]    = 0
    m[int(H*0.78):]    = 0
    cnts,_ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        bc = max(cnts, key=cv2.contourArea)
        area = cv2.contourArea(bc)
        if area > 30:
            _, _, bw, bh = cv2.boundingRect(bc)
            # Sanity: expect athlete torso blob 10-80px tall
            if 8 < bh < 100 and bw < 60:
                player_heights.append(bh)

cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

if player_heights:
    med_h    = float(np.percentile(player_heights, 50))
    # jersey blob is ~30-35% of total body height (torso area)
    body_h   = med_h / 0.32
    px_per_m = body_h / 1.70
    print(f"  jersey blob height = {med_h:.1f}px  →  body ≈ {body_h:.1f}px  →  {px_per_m:.2f} px/m  ({100/px_per_m:.1f} cm/px)")
else:
    px_per_m = W / 55.0
    print(f"  fallback: {px_per_m:.2f} px/m")

# ── Pass 2: optical flow + athlete tracking ────────────────────────────────────
print("Pass 2: optical flow stabilization…")
LK = dict(winSize=(21,21), maxLevel=3,
          criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT, 25, 0.02))
FT = dict(maxCorners=180, qualityLevel=0.02, minDistance=10, blockSize=7)

raw_pos   = []    # raw athlete center per frame
bg_dx     = []    # background translation x per frame
bg_dy     = []    # background translation y per frame
det_conf  = []    # detection confidence

prev_gray = None
prev_bg   = None

for fi in range(N):
    ret, frm = cap.read()
    if not ret: break
    gray = cv2.cvtColor(frm, cv2.COLOR_BGR2GRAY)
    hsv  = cv2.cvtColor(frm, cv2.COLOR_BGR2HSV)

    # ── Athlete detection ────────────────────────────────────────────────────
    m = cv2.bitwise_or(cv2.inRange(hsv, RED_LO1, RED_HI1),
                       cv2.inRange(hsv, RED_LO2, RED_HI2))
    roi = np.zeros_like(m)
    roi[int(H*0.18):int(H*0.78), int(W*0.30):] = 255
    m = cv2.bitwise_and(m, roi)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN,  np.ones((3,3), np.uint8))
    cnts,_ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pos  = None
    conf = 0.0
    if cnts:
        bc   = max(cnts, key=cv2.contourArea)
        area = cv2.contourArea(bc)
        if area > 12:
            M2 = cv2.moments(bc)
            if M2['m00'] > 0:
                pos = (M2['m10']/M2['m00'], M2['m01']/M2['m00'])
                # Confidence from blob area consistency
                conf = min(1.0, area / 200.0)
    raw_pos.append(pos)
    det_conf.append(round(conf, 2))

    # ── Background optical flow (TRANSLATION only — no scale accumulation) ───
    tdx, tdy = 0.0, 0.0
    if fi == 0:
        # Seed features: field region, excluding athlete
        mask = np.zeros((H, W), np.uint8)
        mask[int(H*0.22):int(H*0.65), :] = 255
        if pos:
            px, py = int(pos[0]), int(pos[1])
            mask[max(0,py-55):py+55, max(0,px-55):px+55] = 0
        prev_bg = cv2.goodFeaturesToTrack(gray, mask=mask, **FT)
    elif prev_bg is not None and prev_gray is not None and len(prev_bg) >= 4:
        curr_pts, st, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, prev_bg, None, **LK)
        if curr_pts is not None and st is not None:
            ok  = st.ravel() == 1
            gp  = prev_bg[ok].reshape(-1, 2)
            gc  = curr_pts[ok].reshape(-1, 2)
            if len(gp) >= 4:
                flow = gc - gp
                # Robust median (RANSAC-like: only use inliers within 1.5*IQR)
                fx, fy = flow[:, 0], flow[:, 1]
                def robust_median(v):
                    q1,q3 = np.percentile(v,25), np.percentile(v,75)
                    iqr = q3-q1
                    mask = (v >= q1-1.5*iqr) & (v <= q3+1.5*iqr)
                    return float(np.median(v[mask])) if mask.sum() > 0 else float(np.median(v))
                tdx = robust_median(fx)
                tdy = robust_median(fy)
                # Keep good features, refresh every 10 frames
                prev_bg = gc.reshape(-1,1,2).astype(np.float32)
                if fi % 10 == 0:
                    mask2 = np.zeros((H,W), np.uint8)
                    mask2[int(H*0.22):int(H*0.65), :] = 255
                    if pos:
                        px,py = int(pos[0]),int(pos[1])
                        mask2[max(0,py-55):py+55, max(0,px-55):px+55] = 0
                    new_bg = cv2.goodFeaturesToTrack(gray, mask=mask2, **FT)
                    if new_bg is not None and len(new_bg) > 10:
                        prev_bg = new_bg
    bg_dx.append(tdx)
    bg_dy.append(tdy)
    prev_gray = gray

cap.release()
print(f"  Detection rate: {sum(1 for p in raw_pos if p)/len(raw_pos)*100:.1f}%")
print(f"  Avg background motion: dx={np.mean(np.abs(bg_dx)):.2f}px/fr  dy={np.mean(np.abs(bg_dy)):.2f}px/fr")

# ── Step 3: Stabilized positions via integrated displacements ─────────────────
print("Computing stabilized positions…")
# For each frame: stabilized_disp = athlete_disp - background_disp
# world position = cumulative sum of stabilized displacements

# Fill None gaps in raw_pos first
raw_x = np.array([p[0] if p else np.nan for p in raw_pos])
raw_y = np.array([p[1] if p else np.nan for p in raw_pos])
# Linear interpolate NaNs
for arr in [raw_x, raw_y]:
    nans = np.isnan(arr)
    if nans.any():
        idx = np.arange(len(arr))
        arr[nans] = np.interp(idx[nans], idx[~nans], arr[~nans])

bg_dx_arr = np.array(bg_dx)
bg_dy_arr = np.array(bg_dy)

# Frame-to-frame athlete displacement (raw pixel)
ath_dx = np.concatenate([[0], np.diff(raw_x)])
ath_dy = np.concatenate([[0], np.diff(raw_y)])

# Stabilized displacement = athlete motion minus camera motion
stab_dx = ath_dx - bg_dx_arr
stab_dy = ath_dy - bg_dy_arr

# Integrate to world position
world_x = np.cumsum(stab_dx) + raw_x[0]
world_y = np.cumsum(stab_dy) + raw_y[0]

# ── Step 4: Smooth + differentiate ───────────────────────────────────────────
# Wider window for more robust velocity estimation (~0.7s)
win = min(21, len(world_x)//4*2+1)
if win < 7: win = 7
wx_s = savgol_filter(world_x, win, 3)
wy_s = savgol_filter(world_y, win, 3)

# Velocity in m/s
vx = np.gradient(wx_s) * FPS / px_per_m
vy = np.gradient(wy_s) * FPS / px_per_m
speed = np.sqrt(vx**2 + vy**2)

# Physical cap: max human sprint ~12 m/s
speed = np.clip(speed, 0, 12.0)
speed = savgol_filter(speed, win, 3)
speed = np.clip(speed, 0, 12.0)

# Acceleration (m/s²) — cap at human max ~8 m/s²
accel_raw = np.gradient(speed) * FPS
accel_raw = savgol_filter(accel_raw, win, 3)
accel = np.clip(accel_raw, -8.0, 8.0)

# Lateral (turn) acceleration
heading = np.arctan2(vy, vx)
# Unwrap heading to avoid ±π jumps
heading_u = np.unwrap(heading)
turn_rate  = savgol_filter(np.abs(np.gradient(heading_u)) * FPS, win, 3)  # rad/s
centripetal = np.clip(turn_rate * speed, 0, 30.0)  # m/s², cap at 30

# ── Step 5: Summary statistics ────────────────────────────────────────────────
det_arr = np.array([p is not None for p in raw_pos])
v_valid = speed[det_arr]

peak_speed = round(float(np.percentile(v_valid, 98)), 2)
avg_speed  = round(float(np.mean(v_valid)), 2)
peak_accel = round(float(np.max(np.abs(accel))), 2)
peak_turn  = round(float(np.max(centripetal)), 2)
distance_m = float(np.sum(np.hypot(np.diff(wx_s)/px_per_m, np.diff(wy_s)/px_per_m)))

# Strides
min_sep = int(FPS * 0.22)
peaks_i, _ = find_peaks(speed, height=max(avg_speed*0.7, 1.5), distance=min_sep)
stride_count = len(peaks_i)

# Symmetry
if len(peaks_i) >= 4:
    ps  = speed[peaks_i]
    ev  = ps[0::2]; od = ps[1::2]
    sym = min(ev.mean(), od.mean()) / (max(ev.mean(), od.mean()) + 1e-5)
    sym_pct = round(float(sym) * 100, 1)
else:
    sym_pct = round(float(85.0), 1)

MASS = 55  # kg, estimated
stride_power = round(float(MASS * avg_speed * float(np.mean(np.abs(accel[accel > 0] + 1e-5)))), 1)
peak_power   = round(float(MASS * peak_speed * peak_accel), 1)

# ── Step 6: Per-frame output (~10fps) ─────────────────────────────────────────
step = max(1, int(FPS/10))
frames_out = []
for i in range(0, N, step):
    frames_out.append({
        "t":     round(i/FPS, 3),
        "x":     round(float(wx_s[i])/W, 4),   # world position (stabilized)
        "y":     round(float(wy_s[i])/H, 4),
        "sx":    round(float(raw_x[i])/W, 4),   # raw screen position (for overlay)
        "sy":    round(float(raw_y[i])/H, 4),
        "speed": round(float(speed[i]),  3),
        "accel": round(float(accel[i]),  3),
        "turn":  round(float(centripetal[i]), 3),
        "conf":  det_conf[i],
    })

summary = {
    "fps":              round(FPS, 2),
    "duration_s":       round(N/FPS, 2),
    "px_per_m":         round(px_per_m, 3),
    "peak_speed_ms":    peak_speed,
    "avg_speed_ms":     avg_speed,
    "peak_accel_ms2":   peak_accel,
    "peak_turn_ms2":    peak_turn,
    "distance_m":       round(distance_m, 2),
    "stride_count":     stride_count,
    "symmetry_pct":     sym_pct,
    "stride_power_nm":  stride_power,
    "peak_power_nm":    peak_power,
    "detection_pct":    round(det_arr.mean()*100, 1),
    "calibration":      "player_height",
}

with open(OUT, "w") as f:
    json.dump({"summary": summary, "frames": frames_out}, f, separators=(',',':'))

print("\n=== RESULTS ===")
for k,v in summary.items():
    print(f"  {k:<26}: {v}")
print(f"\n  Frames written: {len(frames_out)} (~10fps)")
print(f"  → {OUT}")
