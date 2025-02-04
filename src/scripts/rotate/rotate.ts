/**
 * Point in 2D space
 */
export interface Point {
  x: number,
  y: number,
}

/**
 * Bounding box
 */
export interface BoundingBox {
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
}

export interface Line {
  type: 'line',
  /**
   * The start of the line
   */
  origin: Point,
  /**
   * The end of the line
   */
  end: Point,
}
export interface Arc {
  type: 'arc',
  /**
   * The center of the arc
   */
  origin: Point,
  /**
   * The start angle of the arc in radians
   */
  startAngle: number,
  /**
   * The end angle of the arc in radians
   */
  endAngle: number,
  /**
   * The radius of the arc
   */
  radius: number,
}
export interface Circle {
  type: 'circle',
  /**
   * The center of the circle
   */
  origin: Point,
  /**
   * The radius of the circle
   */
  radius: number,
}

/**
 * A primitive shape
 */
export type Primative = Line | Arc | Circle;
/**
 * A shape composed of primitives
 */
export type Shape = Primative[];

/**
 * Calculate the bounding box of a shape composed of primitives
 * @param shape The shape, composed of primitives
 * @returns The bounding box
 */
export function computeBoundingBox(shape: Shape): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const updateBounds = (points: Point[]) => {
    if (points.length === 0) return;
    minX = Math.min(minX, ...points.map(p => p.x));
    maxX = Math.max(maxX, ...points.map(p => p.x));
    minY = Math.min(minY, ...points.map(p => p.y));
    maxY = Math.max(maxY, ...points.map(p => p.y));
  };

  const isAngleInArc = (theta: number, start: number, end: number): boolean => {
    const twoPi = 2 * Math.PI;
    theta = ((theta % twoPi) + twoPi) % twoPi;
    let s = ((start % twoPi) + twoPi) % twoPi;
    let e = ((end % twoPi) + twoPi) % twoPi;
    return s <= e ? (theta >= s && theta <= e) : (theta >= s || theta <= e);
  };

  for (const primitive of shape) {
    switch (primitive.type) {
      case 'line': {
        updateBounds([
          primitive.origin,
          primitive.end,
        ]);
        break;
      }
      case 'circle': {
        const cx = primitive.origin.x;
        const cy = primitive.origin.y;
        const r = primitive.radius;
        minX = Math.min(minX, cx - r);
        maxX = Math.max(maxX, cx + r);
        minY = Math.min(minY, cy - r);
        maxY = Math.max(maxY, cy + r);
        break;
      }
      case 'arc': {
        const cx = primitive.origin.x;
        const cy = primitive.origin.y;
        const r = primitive.radius;
        const s = primitive.startAngle;
        const e = primitive.endAngle;
        const points: Point[] = [];

        points.push({
          x: cx + r * Math.cos(s),
          y: cy + r * Math.sin(s)
        });
        points.push({
          x: cx + r * Math.cos(e),
          y: cy + r * Math.sin(e)
        });

        const keyAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
        keyAngles.forEach(theta => {
          if (isAngleInArc(theta, s, e)) {
            points.push({
              x: cx + r * Math.cos(theta),
              y: cy + r * Math.sin(theta)
            });
          }
        });

        updateBounds(points);
        break;
      }
    }
  }

  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Rotate a point around an origin
 * @param p The point to rotate
 * @param angle The angle to rotate by, in radians
 * @param origin The origin to rotate around
 * @returns
 */
export function rotatePoint(p: Point, angle: number, origin: Point = { x: 0, y: 0 }): Point {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const nx = c * (p.x - origin.x) - s * (p.y - origin.y) + origin.x;
  const ny = s * (p.x - origin.x) + c * (p.y - origin.y) + origin.y;
  return { x: nx, y: ny };
}

/**
 * Rotate a shape by an angle
 * @param shape The shape to rotate
 * @param angle The angle to rotate by, in radians
 * @returns The rotated shape
 */
export function rotateShape(shape: Shape, angle: number): Shape {
  return shape.map(prim => {
    switch (prim.type) {
      case 'line':
        return {
          ...prim,
          origin: rotatePoint(prim.origin, angle),
          end: rotatePoint(prim.end, angle),
        };
      case 'arc':
        return {
          ...prim,
          origin: rotatePoint(prim.origin, angle),
          startAngle: prim.startAngle + angle,
          endAngle: prim.endAngle + angle,
        };
      case 'circle':
        return {
          ...prim,
          origin: rotatePoint(prim.origin, angle),
        };
    }
  });
}

/**
 * Find the angle that minimizes the area of the bounding box of a shape
 * @param shape The shape
 * @param step The step size for the search
 * @returns The angle that minimizes the area of the bounding box in degrees
 */
export function findMinAreaRotationAngle(shape: Shape, step = .2) {
  const currentBoundingBox = computeBoundingBox(shape);
  let bestRotation = 0;
  let minArea = Infinity;
  let bestBoundingBox = currentBoundingBox;

  const searchRange = 92;
  const searchStart = -(searchRange / 2);
  const steps = searchRange / step;

  for (let i = 0; i < steps; i++) {
    const degrees = searchStart + i * step;
    const radians = (degrees * Math.PI) / 180;
    const rotated = rotateShape(shape, radians);
    const { minX, maxX, minY, maxY } = computeBoundingBox(rotated);
    const area = (maxX - minX) * (maxY - minY);
    if (area < minArea) {
      minArea = area;
      bestRotation = degrees;
      bestBoundingBox = { minX, maxX, minY, maxY };
    }
  }

  return {
    bestRotation,
    currentBoundingBox,
    bestBoundingBox,
  };
}
