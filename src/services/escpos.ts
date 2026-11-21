/**
 * ESC/POS Command Generator for Thermal Receipt Printers (Bluetooth & USB Serial)
 */

export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  // ESC @: Initialize printer
  init(): this {
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  // ESC a n: Justification (0: Left, 1: Center, 2: Right)
  align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1B, 0x61, val);
    return this;
  }

  // ESC E n: Bold mode
  bold(enable: boolean = true): this {
    this.buffer.push(0x1B, 0x45, enable ? 1 : 0);
    return this;
  }

  // ESC ! n: Character font & size
  // size: 'normal' | 'double-height' | 'double-width' | 'double-size'
  fontSize(size: 'normal' | 'double-height' | 'double-width' | 'double-size' = 'normal'): this {
    let val = 0;
    if (size === 'double-height') val = 0x10;
    if (size === 'double-width') val = 0x20;
    if (size === 'double-size') val = 0x30;
    this.buffer.push(0x1B, 0x21, val);
    return this;
  }

  // Append raw text (ASCII / UTF-8 safe)
  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (const b of bytes) {
      this.buffer.push(b);
    }
    return this;
  }

  // Append line
  line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0A); // LF
    return this;
  }

  // Feed n lines
  feed(lines: number = 1): this {
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  // Separator line based on columns (32 for 58mm, 48 for 80mm)
  separator(char: string = '-', width: 32 | 48 = 32): this {
    this.align('center');
    this.line(char.repeat(width));
    return this;
  }

  // Two column text row (e.g. Left title, Right value)
  twoColumn(left: string, right: string, width: 32 | 48 = 32): this {
    this.align('left');
    const spaceCount = width - (left.length + right.length);
    if (spaceCount > 0) {
      this.line(left + ' '.repeat(spaceCount) + right);
    } else {
      this.line(left);
      this.align('right');
      this.line(right);
    }
    return this;
  }

  // Kick cash drawer (ESC p 0 25 250)
  openCashDrawer(): this {
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  // Cut paper (GS V 66 0)
  cut(): this {
    this.feed(3);
    this.buffer.push(0x1D, 0x56, 0x42, 0x00);
    return this;
  }

  // Add monochrome raster bitmap image (GS v 0) from an Image element or Canvas
  rasterImage(canvas: HTMLCanvasElement): this {
    const ctx = canvas.getContext('2d');
    if (!ctx) return this;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const widthBytes = Math.ceil(width / 8);
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    this.align('center');
    // GS v 0 0 xL xH yL yH
    this.buffer.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < widthBytes; x++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          const px = x * 8 + b;
          if (px < width) {
            const idx = (y * width + px) * 4;
            // Greyscale luminance
            const r = data[idx];
            const g = data[idx + 1];
            const bl = data[idx + 2];
            const a = data[idx + 3];
            const lum = (0.299 * r + 0.587 * g + 0.114 * bl);
            // Black pixel if lum < 128 and not transparent
            if (a > 128 && lum < 160) {
              byte |= (1 << (7 - b));
            }
          }
        }
        this.buffer.push(byte);
      }
    }
    this.line();
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
