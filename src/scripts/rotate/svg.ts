import type { BoundingBox, Point, Primative, Shape } from "./rotate";

export function toSVG(shape: Shape, bbox: BoundingBox): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.minX} ${bbox.minY} ${bbox.maxX - bbox.minX} ${bbox.maxY - bbox.minY}">
<style>
* {fill: none;stroke: white;stroke-width: ${Math.min(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) / 200};}
</style>
<rect x="${bbox.minX}" y="${bbox.minY}" width="${bbox.maxX - bbox.minX}" height="${bbox.maxY - bbox.minY}" style="stroke: aqua;" />
`;

  for (const primative of shape) {
    switch (primative.type) {
      case 'line':
        const line = primative;
        svg += `<line x1="${line.origin.x}" y1="${line.origin.y}" x2="${line.end.x}" y2="${line.end.y}" />`
        break;
      case 'arc':
        const arc = primative;
        const start = pointOnCircle(arc.origin, arc.radius, arc.startAngle);
        const end = pointOnCircle(arc.origin, arc.radius, arc.endAngle);
        svg += `<path d="M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 0 0 ${end.x} ${end.y}" />`;
        break;
      case 'circle':
        const circle = primative;
        svg += `<circle cx="${circle.origin.x}" cy="${circle.origin.y}" r="${circle.radius}" />`;
        break;
    }
  }

  svg += '</svg>';
  return svg;
}

function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}
