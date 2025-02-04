import {
  parseString as parseDxfString,
} from 'dxf';
import type { Shape, Primative, Line, Arc, Circle } from './rotate';
import type {
  Line as DxfLine,
  Arc as DxfArc,
  Circle as DxfCircle,
} from 'dxf/handlers/entities';

export function parseDxf(dxfContent: string): Shape {
  const parsed = parseDxfString(dxfContent);
  console.log(parsed);
  const primitives: Primative[] = [];

  for (const entity of parsed.entities) {
    let primative: Primative | null = null;

    // ts type is wrong here
    // should be type, not TYPE
    switch ((entity as any).type) {
      case 'LINE':
        primative = mapLine(entity);
        break;
      case 'ARC':
        primative = mapArc(entity as DxfArc);
        break;
      case 'CIRCLE':
        primative = mapCircle(entity);
        break;
      default:
        continue;
    }

    if (primative) {
      primitives.push(primative);
    }
  }

  return primitives;
}

function mapLine(entity: DxfLine): Line | null {
  if (!entity.start || !entity.end) return null;
  if (entity.start.x === undefined || entity.start.y === undefined || entity.end.x === undefined || entity.end.y === undefined) {
    return null;
  }
  return {
    type: 'line',
    origin: { x: entity.start.x, y: entity.start.y },
    end: { x: entity.end.x, y: entity.end.y },
  };
}

function mapArc(entity: DxfArc): Arc | null {
  if (entity.x === undefined || entity.y === undefined || entity.r === undefined ||
    entity.startAngle === undefined || entity.endAngle === undefined) {
    return null;
  }
  return {
    type: 'arc',
    origin: { x: entity.x, y: entity.y },
    startAngle: entity.startAngle,
    endAngle: entity.endAngle,
    radius: entity.r,
  };
}

function mapCircle(entity: DxfCircle): Circle | null {
  if (entity.x === undefined || entity.y === undefined || entity.r === undefined) return null;
  return {
    type: 'circle',
    origin: { x: entity.x, y: entity.y },
    radius: entity.r,
  };
}
