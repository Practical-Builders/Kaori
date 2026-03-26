"""
Soccer Biomechanics AI — FastAPI Backend

AI Mechanics Engine API: video upload, biomechanical analysis, and injury risk assessment.
"""

import logging
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from mechanics_engine import (
    extract_pose,
    compute_kinematics,
    detect_critical_events,
    assess_injury_risk,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Soccer Biomechanics AI",
    description="AI Mechanics Engine for kinematic, dynamic, and injury risk analysis.",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"}


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "Soccer Biomechanics AI", "status": "ok", "version": "0.4.0"}


@app.post("/upload-video")
async def upload_video(
    video: UploadFile = File(...),
    height_cm: Optional[float] = Form(None),
    weight_kg: Optional[float] = Form(None),
    target_x: Optional[float] = Form(None),  # 0.0=left side, 1.0=right side, None=largest
) -> dict:
    """
    Accept an uploaded video + optional athlete measurements, run the full pipeline:
      1. Pose extraction (MediaPipe) — multi-person aware, locks onto primary athlete
      2. Kinematic computation — angles, velocity, torque (uses height/weight if provided)
      3. Critical event detection — stride peaks, direction changes
      4. Injury risk assessment — ACL, hamstring, ankle, overuse
    """
    if video.content_type not in ALLOWED_CONTENT_TYPES:
        return {
            "ok": False,
            "error": f"Unsupported type: {video.content_type}. Use MP4, MOV, AVI, or WebM.",
        }

    content = await video.read()
    suffix = Path(video.filename or "video").suffix or ".mp4"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Stage 1: Pose extraction
        logger.info("Stage 1: Extracting pose from %s (target_x=%s)", video.filename, target_x)
        pose_data = extract_pose(tmp_path, target_x=target_x)
    except Exception as e:
        logger.error("Pose extraction failed: %s", e)
        return {"ok": False, "error": f"Pose extraction failed: {str(e)}"}
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    try:
        # Stage 2: Kinematics (use athlete measurements if provided)
        logger.info("Stage 2: Computing kinematics (%d frames) height=%.0fcm weight=%.0fkg",
                    len(pose_data.get("frames", [])), height_cm or 0, weight_kg or 0)
        cleaned_kinematics = compute_kinematics(
            pose_data,
            height_cm=height_cm,
            weight_kg=weight_kg,
        )
    except Exception as e:
        logger.error("Kinematic computation failed: %s", e)
        return {"ok": False, "error": f"Kinematic computation failed: {str(e)}"}

    try:
        # Stage 3: Critical event detection
        logger.info("Stage 3: Detecting critical events")
        events = detect_critical_events(cleaned_kinematics)
    except Exception as e:
        logger.warning("Event detection failed (non-fatal): %s", e)
        events = {
            "critical_events": [],
            "velocity_spike_timestamps_ms": [],
            "performance_highlights": {},
        }

    try:
        # Stage 4: Injury risk assessment
        logger.info("Stage 4: Assessing injury risk")
        injury_risk = assess_injury_risk(cleaned_kinematics)
    except Exception as e:
        logger.warning("Injury risk assessment failed (non-fatal): %s", e)
        injury_risk = {
            "disclaimer": "Risk assessment unavailable for this video.",
            "overall": {"level": "unknown", "score": 0.0, "summary": str(e)},
            "risk_categories": {},
        }

    frame_count = len(pose_data.get("frames", []))
    return {
        "ok": True,
        "filename": video.filename or "video",
        "size_bytes": len(content),
        "frame_count": frame_count,
        # Stage outputs
        "pose": pose_data,
        "cleaned_kinematics": cleaned_kinematics,
        "critical_events": events.get("critical_events", []),
        "velocity_spike_timestamps_ms": events.get("velocity_spike_timestamps_ms", []),
        "performance_highlights": events.get("performance_highlights", {}),
        "injury_risk": injury_risk,
        "message": (
            f"Processed {frame_count} frames. "
            f"Kinematic dataset, event detection, and injury risk profile attached."
        ),
    }
