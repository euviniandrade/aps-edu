#!/usr/bin/env python3
"""
Generates PWA icons in all required sizes.
Creates a gold sparkle icon on dark background.
Run: python generate-icons.py
"""
import os
import struct
import zlib

def create_png(width, height, bg_color, icon_color):
    """Create a simple PNG with a gold circle on dark background."""

    def png_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_data = chunk_type + data
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_data) & 0xffffffff)
        return chunk_len + chunk_data + chunk_crc

    # Create pixel data
    pixels = []
    cx, cy = width // 2, height // 2
    r = int(width * 0.38)
    inner_r = int(width * 0.18)

    bg_r, bg_g, bg_b = bg_color
    ic_r, ic_g, ic_b = icon_color

    for y in range(height):
        row = [0]  # filter byte
        for x in range(width):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            # Outer circle (dark ring)
            if dist <= r:
                # Inner icon area
                if dist <= inner_r:
                    row.extend([ic_r, ic_g, ic_b, 255])
                else:
                    # Ring with gradient
                    t = (dist - inner_r) / (r - inner_r)
                    rr = int(ic_r + (bg_r - ic_r) * t * 0.3)
                    gg = int(ic_g + (bg_g - ic_g) * t * 0.3)
                    bb = int(ic_b + (bg_b - ic_b) * t * 0.3)
                    row.extend([rr, gg, bb, 255])
            else:
                # Background with padding
                pad = int(width * 0.05)
                if dist <= r + pad:
                    t = (dist - r) / pad
                    row.extend([bg_r, bg_g, bg_b, int(255 * (1 - t))])
                else:
                    row.extend([bg_r, bg_g, bg_b, 255])
        pixels.append(bytes(row))

    raw_data = b''.join(pixels)
    compressed = zlib.compress(raw_data, 9)

    png = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += png_chunk(b'IHDR', ihdr_data)
    png += png_chunk(b'IDAT', compressed)
    png += png_chunk(b'IEND', b'')

    return png

def main():
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    icons_dir = os.path.join(os.path.dirname(__file__), 'public', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    bg = (6, 7, 15)        # #06070F
    gold = (248, 163, 3)   # #F8A303

    for size in sizes:
        png_data = create_png(size, size, bg, gold)
        path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
        with open(path, 'wb') as f:
            f.write(png_data)
        print(f'Created {path}')

    print(f'\nAll {len(sizes)} icons created in {icons_dir}')

if __name__ == '__main__':
    main()
