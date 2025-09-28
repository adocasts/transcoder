# ############################################
#
# faster_whisper command line integration
# enables faster transcription than the base
# whisper python package
#
# ############################################
import sys
import os
from faster_whisper import WhisperModel
from datetime import timedelta

# Function to convert time in seconds to SRT format (HH:MM:SS,mmm)
def format_timestamp(seconds):
    td = timedelta(seconds=seconds)

    total_seconds = int(td.total_seconds())
    milliseconds = td.microseconds // 1000

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"

if len(sys.argv) < 4:
    print("Usage: python transcribe_fast.py <audio_path> <output_dir> <model_size>")
    sys.exit(1)

audio_path = sys.argv[1].strip('\"')
output_dir = sys.argv[2].strip('\"')
model_size = sys.argv[3]

# NOTE: Keeping device="cpu" as that was the fix for your environment
model = WhisperModel(model_size, device="cpu", compute_type="int8")

# The result is a generator of segments
segments, info = model.transcribe(
    audio_path,
    language="en",
    word_timestamps=False
)

# --- Output Preparation ---

# 1. Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Get base filename for outputs
audio_filename = os.path.splitext(os.path.basename(audio_path))[0]
srt_output_path = os.path.join(output_dir, "en.srt")
txt_output_path = os.path.join(output_dir, "en.txt")

# Initialize a list to hold all text for the TXT file
full_transcript_text = []

# --- SRT & TXT Generation Loop ---

subtitle_index = 1

with open(srt_output_path, "w", encoding="utf-8") as srt_file:
    for segment in segments:
        text = segment.text.strip()
        start_time = format_timestamp(segment.start)
        end_time = format_timestamp(segment.end)

        # 1. SRT FILE CONTENT
        srt_file.write(f"{subtitle_index}\n")
        srt_file.write(f"{start_time} --> {end_time}\n")
        srt_file.write(f"{text}\n")
        srt_file.write("\n")

        # 2. TXT FILE CONTENT (Append text to the list)
        full_transcript_text.append(text)

        subtitle_index += 1

# --- Final TXT File Write ---

# Join all segments with a space and write to the TXT file
final_text = " ".join(full_transcript_text)

with open(txt_output_path, "w", encoding="utf-8") as txt_file:
    txt_file.write(final_text)

print(f"Transcription complete. SRT saved to {srt_output_path} and TXT saved to {txt_output_path}")
