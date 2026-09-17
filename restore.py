import json
import sys

transcript_path = "/home/techzar/.gemini/antigravity-ide/brain/92915884-968e-4e8e-8c4e-8689b775f3e1/.system_generated/logs/transcript_full.jsonl"
out_path = "src/app/(dashboard)/quotes/new/page.tsx"

content_lines = {}
with open(transcript_path, 'r') as f:
    for line in f:
        try:
            entry = json.loads(line)
            if entry.get("type") == "VIEW_FILE" and entry.get("status") == "DONE":
                content = entry.get("content", "")
                if "quotes/new/page.tsx" in content:
                    lines = content.split('\n')
                    is_old_version = False
                    # We can identify the old version because it has 571 lines. The new one has 766 lines.
                    if "Total Lines: 571" in content:
                        for l in lines:
                            if ':' in l:
                                parts = l.split(':', 1)
                                if parts[0].isdigit():
                                    line_num = int(parts[0])
                                    content_lines[line_num] = parts[1][1:] if parts[1].startswith(' ') else parts[1]
        except:
            pass

if content_lines:
    max_line = max(content_lines.keys())
    if max_line != 571:
        print(f"Warning: expected 571 lines, got {max_line}")
    with open(out_path, 'w') as out:
        for i in range(1, max_line + 1):
            out.write(content_lines.get(i, "") + "\n")
    print(f"Restored {max_line} lines successfully.")
else:
    print("Could not find the original file content.")
