
import os
from PIL import Image

SCRIPT_DIR = os.getcwd()
LOGO_PATH = os.path.join(SCRIPT_DIR, 'public', 'logo.png')
ICON_PATH = os.path.join(SCRIPT_DIR, 'public', 'icon.png')
ICON_SQUARE_PATH = os.path.join(SCRIPT_DIR, 'src-tauri', 'icons', 'icon.png')
WORDMARK_PATH = os.path.join(SCRIPT_DIR, 'public', 'wordmark.png')

def process_image():
    try:
        print(f"Opening {LOGO_PATH}")
        with Image.open(LOGO_PATH) as img:
            img = img.convert("RGBA")
            width, height = img.size
            print(f"Original Size: {width}x{height}")

            # Autocrop (get bbox)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
                print(f"Autocropped Size: {img.size}")
            
            crop_width, crop_height = img.size

            # Find split logic
            # Scan for horizontal gap of transparency/white
            split_y = -1
            max_gap = 0
            current_gap = 0
            best_gap_start = -1
            
            # Scan middle 50%
            start_scan = int(crop_height * 0.3)
            end_scan = int(crop_height * 0.8)

            pixels = img.load()

            for y in range(start_scan, end_scan):
                is_line_empty = True
                for x in range(crop_width):
                    r, g, b, a = pixels[x, y]
                    # Check for non-white, non-transparent pixels
                    # If alpha > 20 and it's not effectively white
                    if a > 20 and not (r > 240 and g > 240 and b > 240):
                        is_line_empty = False
                        break
                
                if is_line_empty:
                    if current_gap == 0:
                        best_gap_start = y
                    current_gap += 1
                else:
                    if current_gap > max_gap:
                        max_gap = current_gap
                        split_y = best_gap_start + (current_gap // 2)
                    current_gap = 0
            
            if split_y == -1 or max_gap < 5:
                print("No clear gap found. Fallback split at 65%.")
                split_y = int(crop_height * 0.65)
            else:
                print(f"Found gap of {max_gap}px. Splitting at Y={split_y}")

            # --- ICON ---
            icon_part = img.crop((0, 0, crop_width, split_y))
            # trimming empty space around icon
            icon_bbox = icon_part.getbbox()
            if icon_bbox:
                icon_part = icon_part.crop(icon_bbox)
            
            icon_w, icon_h = icon_part.size
            max_dim = max(icon_w, icon_h)
            
            # Create square canvas with White Circular Background
            from PIL import ImageDraw
            
            # Create a white circle background
            white_bg = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
            draw = ImageDraw.Draw(white_bg)
            draw.ellipse((0, 0, max_dim, max_dim), fill=(255, 255, 255, 255))
            
            # User requested 0.1% bigger background, meaning icon is almost full size.
            # Using 0.5% padding (0.005) just to be safe but effectively full size.
            padding = int(max_dim * 0.005) 
            icon_size = max_dim - (2 * padding)
            icon_resized = icon_part.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            
            offset = (padding, padding)
            
            if icon_size != icon_w: # Only resize if changed significantly
                 # But we need to center the original rectangular icon in the square space
                 # If icon_part is "wide", we scale width to icon_size.
                 # If "tall", scale height.
                 # Actually `icon_part` geometry:
                 ratio = min(icon_size / icon_w, icon_size / icon_h)
                 new_w = int(icon_w * ratio)
                 new_h = int(icon_h * ratio)
                 icon_resized = icon_part.resize((new_w, new_h), Image.Resampling.LANCZOS)
                 
                 # Centering offset
                 offset = ((max_dim - new_w) // 2, (max_dim - new_h) // 2)
            else:
                 offset = ((max_dim - icon_w) // 2, (max_dim - icon_h) // 2)

            # Composite icon onto white background
            white_bg.paste(icon_resized, offset, icon_resized)
            square_icon = white_bg
            
            print(f"Saving Icon to {ICON_PATH}")
            square_icon.save(ICON_PATH)

            print("Saving Tauri Icons...")
            square_icon.resize((512, 512), Image.Resampling.LANCZOS).save(ICON_SQUARE_PATH)
            square_icon.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(SCRIPT_DIR, 'src-tauri', 'icons', '128x128.png'))
            square_icon.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(SCRIPT_DIR, 'src-tauri', 'icons', '32x32.png'))

            # --- WORDMARK ---
            wordmark_part = img.crop((0, split_y, crop_width, crop_height))
            wordmark_bbox = wordmark_part.getbbox()
            if wordmark_bbox:
                wordmark_part = wordmark_part.crop(wordmark_bbox)
            
            print(f"Saving Wordmark to {WORDMARK_PATH}")
            wordmark_part.save(WORDMARK_PATH)
            
            print("Done")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    process_image()
