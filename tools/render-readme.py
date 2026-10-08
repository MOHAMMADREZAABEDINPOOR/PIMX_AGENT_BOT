"""Render the README's original animated phone and provider network. Requires Pillow."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

DEST = Path(__file__).resolve().parents[1] / 'assets' / 'readme'
DEST.mkdir(parents=True, exist_ok=True)
FONTS = Path('C:/Windows/Fonts')

def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)

frames = []
for frame in range(36):
    phase = frame / 36 * math.tau
    image = Image.new('RGB', (1200, 440), '#101016')
    d = ImageDraw.Draw(image)
    for x in range(0, 1200, 32):
        for y in range(0, 440, 32):
            d.ellipse((x, y, x+1, y+1), fill='#282635')
    d.rounded_rectangle((20,20,1180,420), 24, outline='#343044', width=1)
    d.text((55,53), 'PIMX / TELEGRAM INTELLIGENCE', font=font(15), fill='#b29be9')
    d.text((51,119), 'PIMX AGENT', font=font(64, True), fill='#f5f2ff')
    d.text((55,194), 'BOT + MINI APP', font=font(32, True), fill='#a99af7')
    d.text((55,257), 'Your models. Your memory. Your workspace.', font=font(20), fill='#a9a4ba')
    for i, label in enumerate(['LIVE CHAT', 'MULTI-MODEL', 'PORTABLE DATA']):
        x = 55 + i*170
        d.rounded_rectangle((x,321,x+154,354), 10, fill='#201c2d', outline='#443958')
        d.text((x+13,329), label, font=font(12,True), fill='#c8b8f4')
    d.text((55,384), 'CLOUDFLARE WORKERS / D1 + KV / EN + FA', font=font(12), fill='#726b88')
    d.line((630,85,630,355), fill='#343044')
    # Floating provider tiles feed a central Telegram workspace.
    nodes = [(717,112,'API'),(1080,123,'AI'),(714,324,'RAG'),(1075,317,'MCP')]
    for j,(x,y,label) in enumerate(nodes):
        y += int(5*math.sin(phase+j))
        d.line((x,y,903,224), fill='#4c426b', width=2)
        t = ((frame/36+j/4) % 1)
        px,py=x+(903-x)*t,y+(224-y)*t
        d.ellipse((px-3,py-3,px+3,py+3), fill='#83d8dc')
        d.rounded_rectangle((x-35,y-23,x+35,y+23), 12, fill='#231e33', outline='#8873b4', width=2)
        d.text((x-18,y-10),label,font=font(16,True),fill='#c3b4ef')
    d.rounded_rectangle((811,52,994,390), 29, fill='#0b0b12', outline='#796891', width=3)
    d.rounded_rectangle((822,64,983,378), 21, fill='#1b1825', outline='#3c344d')
    d.rounded_rectangle((871,71,934,82), 5, fill='#0b0b12')
    # An AI face above two live chat bubbles and a back-navigation control.
    d.rounded_rectangle((856,107,949,178), 21, fill='#3c3056', outline='#ad93d9', width=2)
    for x in [883,921]:
        d.rounded_rectangle((x-6,128,x+6,141), 4, fill='#8edee1')
    d.arc((884,140,923,164), 0,180,fill='#c8b5ed',width=2)
    d.text((843,192),'PIMXAGENT',font=font(17,True),fill='#ddd4f2')
    d.rounded_rectangle((846,230,964,267), 10, fill='#52406f')
    d.rounded_rectangle((837,279,955,324), 10, fill='#2a2439')
    for y,x2 in [(242,947),(253,918),(291,937),(303,926)]:
        d.line((849,y,x2,y),fill='#b7a5d5',width=3)
    d.line((846,349,869,349),fill='#8ddadd',width=2)
    d.line((846,349,853,342),fill='#8ddadd',width=2)
    d.line((846,349,853,356),fill='#8ddadd',width=2)
    d.text((882,339),'BACK',font=font(12,True),fill='#b7a5d5')
    frames.append(image)

frames[0].save(DEST/'hero.png', optimize=True)
palette = frames[0].quantize(colors=128)
indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
indexed[0].save(DEST/'hero.gif', save_all=True, append_images=indexed[1:], duration=90, loop=0, optimize=True)
print('Generated hero.png and hero.gif')
