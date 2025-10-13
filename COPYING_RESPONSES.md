# Copying Response Data

## Quick Copy (Recommended)
**Press `c` when the Response panel is focused** to copy the entire response body to clipboard.

## Terminal Text Selection

Due to mouse capture in terminal UIs, text selection varies by terminal:

### macOS
- **iTerm2**: Hold `Option` (⌥) while dragging to select text
- **Terminal.app**: Hold `Option` (⌥) while dragging
- **Alacritty**: Hold `Shift` while dragging

### Linux
- **GNOME Terminal**: Hold `Shift` while dragging
- **Konsole**: Hold `Shift` while dragging
- **Alacritty**: Hold `Shift` while dragging

### Alternative: Save to File
Focus the Response panel and press `c` to copy, or pipe output:
```bash
http examples/requests.http | jq . > response.json
```

## Why Text Selection is Limited

Terminal applications that use mouse tracking (for click-to-focus, scrolling, etc.) must run in "raw mode" which captures mouse events before the terminal can process them for text selection. This is a fundamental limitation of terminal UI applications.

**Recommended workflow**: Use `c` key to copy entire response, then paste into your editor for further manipulation.
