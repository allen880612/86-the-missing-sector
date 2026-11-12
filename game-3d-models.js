(function (global) {
  'use strict';

  function create(scene) {
    const B = global.BABYLON;
    const materials = {};
    const textures = [];
    const sources = new Map();
    const roots = new Set();
    let playerAsset = null;
    let serial = 0;
    const tau = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const configurations = {
      player: { legs: 4, width: .82, length: 1.5, height: 1.15, spread: 2.45, reach: 1.85, stride: .9, armor: 'ivory' },
      scout: { legs: 6, width: .7, length: 1.35, height: .97, spread: 2, reach: 1.8, stride: .78, armor: 'legion' },
      hunter: { legs: 6, width: 1, length: 1.55, height: 1.18, spread: 2.65, reach: 2.05, stride: 1.02, armor: 'legion' },
      heavy: { legs: 8, width: 2.15, length: 2.8, height: 1.6, spread: 4.65, reach: 3.75, stride: 1.2, armor: 'heavy' }
    };

    function material(name, color, metallic, roughness, emissive) {
      const mat = new B.PBRMaterial('sortie-' + name, scene);
      mat.albedoColor = B.Color3.FromHexString(color);
      mat.metallic = metallic;
      mat.roughness = roughness;
      if (emissive) mat.emissiveColor = B.Color3.FromHexString(emissive);
      materials[name] = mat;
    }
    material('ivory', '#e2e0d3', .36, .44);
    material('ivoryDark', '#9aafb4', .56, .48);
    material('legion', '#435f79', .54, .43);
    material('heavy', '#344c61', .57, .48);
    material('edge', '#7e9baa', .68, .32);
    material('steel', '#283740', .8, .47);
    material('joint', '#111b23', .6, .64);
    material('red', '#a8493c', .35, .5);
    material('sensor', '#ba4b35', .25, .32, '#7c2115');
    material('blueSensor', '#9ddbdc', .1, .26, '#52898e');
    material('concrete', '#555e5b', .01, .98);
    material('concreteTop', '#7c8174', .01, .96);
    material('asphalt', '#89999c', .01, .99);
    material('road', '#a0aaa8', .01, .97);
    material('roadCross', '#929e9d', .01, .98);
    material('rust', '#765342', .28, .89);
    material('stripe', '#9d8c5b', .05, .91);
    material('stain', '#252d2e', .03, 1);

    function source(shape, mat) {
      const key = shape + ':' + mat;
      if (sources.has(key)) return sources.get(key);
      let mesh;
      if (shape === 'cylinder') {
        mesh = B.MeshBuilder.CreateCylinder(key, { diameter: 1, height: 1, tessellation: 8 }, scene);
      } else if (shape === 'wedge') {
        mesh = new B.Mesh(key, scene);
        const points = [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.23,.2,-.5],[.23,.2,-.5],[.4,.5,.35],[-.4,.5,.35]];
        const faces = [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]];
        const positions = [], indices = [], normals = [];
        for (const f of faces) {
          const n = positions.length / 3;
          for (const p of f) positions.push(...points[p]);
          indices.push(n,n+1,n+2,n,n+2,n+3);
        }
        B.VertexData.ComputeNormals(positions, indices, normals);
        const data = new B.VertexData();
        data.positions = positions; data.indices = indices; data.normals = normals;
        data.applyToMesh(mesh);
      } else mesh = B.MeshBuilder.CreateBox(key, { size: 1 }, scene);
      mesh.material = materials[mat];
      mesh.receiveShadows = true;
      mesh.isVisible = false;
      mesh.isPickable = false;
      sources.set(key, mesh);
      return mesh;
    }

    function part(parent, shape, mat, x, y, z, w, h, d, rz = 0, rx = 0) {
      const mesh = source(shape, mat).createInstance('part-' + serial++);
      mesh.parent = parent;
      mesh.position.set(x, y, z);
      mesh.scaling.set(w, h, d);
      mesh.rotation.set(rx, 0, rz);
      mesh.isPickable = false;
      return mesh;
    }

    function node(name, parent) {
      const result = new B.TransformNode(name, scene);
      if (parent) result.parent = parent;
      return result;
    }

    function link(mesh, ax, ay, az, bx, by, bz, thickness, depth) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const length = Math.max(.001, Math.hypot(dx, dy, dz));
      mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      mesh.scaling.set(thickness, length, depth);
      if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new B.Quaternion();
      const q = mesh.rotationQuaternion;
      if (dy / length < -.99999) q.set(1, 0, 0, 0);
      else { q.set(dz / length, 0, -dx / length, 1 + dy / length); q.normalize(); }
    }

    function createMech(kind, id) {
      const cfg = configurations[kind] || configurations.scout;
      const root = node('mech-' + id);
      const body = node('hull-' + id, root);
      const turret = node('turret-' + id, body);
      const barrel = node('recoil-' + id, turret);
      const muzzle = node('muzzle-' + id, barrel);
      const isPlayer = kind === 'player', isHeavy = kind === 'heavy';
      const width = cfg.width, length = cfg.length;
      const trim = isPlayer ? 'ivoryDark' : 'edge';
      body.position.y = cfg.height;
      turret.position.y = isHeavy ? .7 : .42;
      part(body, 'wedge', cfg.armor, 0, .06, -.1, width * 2.15, .78, length * 2);
      part(body, 'wedge', trim, 0, -.22, -.4, width * 1.55, .5, length * 1.55);
      part(body, 'box', 'joint', 0, -.28, .1, width * 1.6, .36, length * 1.8);
      part(body, 'wedge', 'steel', 0, .14, -length + .16, width * .92, .28, .64);
      part(body, 'box', isPlayer ? 'blueSensor' : 'sensor', 0, .23, -length - .02, width * .62, .1, .06);
      for (const side of [-1, 1]) {
        part(body, 'wedge', cfg.armor, side * width * .78, .25, .2, width * .75, .38, length * 1.3);
        part(body, 'box', 'joint', side * width * .63, .39, length * .64, width * .43, .09, .65);
        for (let j = 0; j < 3; j++) part(body, 'box', 'steel', side * width * .63, .46, length * .64 + (j - 1) * .16, width * .4, .035, .06);
      }
      part(turret, 'cylinder', 'joint', 0, 0, .25, width * .85, .18, width * .85);
      part(turret, 'wedge', cfg.armor, 0, .12, .26, width * 1.04, .42, length * .94);
      const gunLength = isHeavy ? 5.6 : isPlayer ? 3.15 : kind === 'hunter' ? 1.7 : 1.18;
      const gunRadius = isHeavy ? .29 : isPlayer ? .105 : .095;
      const gunStart = -.26;
      part(barrel, 'box', 'steel', 0, .13, gunStart - .22, gunRadius * 3.1, gunRadius * 2.7, .75);
      part(barrel, 'cylinder', trim, 0, .15, gunStart - gunLength / 2, gunRadius * 2, gunLength, gunRadius * 2, 0, Math.PI / 2);
      part(barrel, 'box', 'joint', 0, .15, gunStart - gunLength, gunRadius * 2.65, gunRadius * 2.35, .3);
      part(barrel, 'box', 'steel', 0, .15, gunStart - gunLength - .16, gunRadius * 1.55, gunRadius * 1.3, .015);
      muzzle.position.set(0, .15, gunStart - gunLength - .2);
      if (isPlayer) {
        part(barrel, 'box', 'red', 0, .15, -1.05, .24, .23, .12);
        part(body, 'box', 'red', -.56, .48, .25, .22, .025, .08);
        part(body, 'box', 'red', -.56, .48, .38, .22, .025, .08);
        for (const side of [-1, 1]) {
          part(body, 'cylinder', 'steel', side * .7, -.35, -1.14, .27, .32, .27, Math.PI / 2);
          part(body, 'box', 'joint', side * .81, -.53, -1.7, .13, .16, 1.35, side * .08, -.11);
          part(body, 'wedge', 'ivoryDark', side * .88, -.55, -2.25, .28, .15, 1.5);
          part(body, 'wedge', 'steel', side * .88, -.62, -2.42, .21, .08, 1.56);
        }
        part(body, 'box', 'steel', .52, .78, 1.13, .035, 1.02, .035, -.08);
      } else if (kind === 'scout') {
        part(body, 'wedge', cfg.armor, 0, 1, .6, .58, 1.88, 2.2, 0, -.2);
        part(body, 'wedge', 'edge', 0, 1.2, .52, .12, 1.48, 2.24, 0, -.2);
        for (const side of [-1, 1]) {
          part(body, 'box', 'steel', side * .6, .08, -1.65, .08, .09, 1.22);
          part(body, 'box', 'sensor', side * .6, .08, -2.25, .11, .12, .04);
        }
      } else if (kind === 'hunter') {
        for (const side of [-1, 1]) {
          part(turret, 'wedge', cfg.armor, side * .77, .66, .2, .76, .75, 1.95);
          part(turret, 'box', 'joint', side * .77, .63, -.78, .59, .46, .05);
          for (let j = 0; j < 3; j++) part(turret, 'cylinder', 'steel', side * .77 + (j - 1) * .16, .63, -.83, .11, .045, .11, 0, Math.PI / 2);
          part(body, 'wedge', 'edge', side * 1.02, -.03, -1.85, .38, .38, 1.54, side * -.2);
        }
      } else if (isHeavy) {
        part(body, 'wedge', cfg.armor, 0, .52, .88, 3.75, .92, 3.7);
        for (const side of [-1, 1]) {
          part(body, 'wedge', 'edge', side * 1.74, .96, 1.68, .72, 1.6, 2.25, side * -.38, -.18);
          part(turret, 'wedge', cfg.armor, side * .73, .32, -.6, .76, .43, 2.35);
        }
        part(barrel, 'cylinder', 'steel', .52, -.02, -2, .24, 3.5, .24, 0, Math.PI / 2);
        for (let j = 0; j < 5; j++) part(body, 'box', 'steel', 0, 1.04, 1 + j * .24, 1.58, .07, .085);
      }
      const legs = [];
      const perSide = cfg.legs / 2;
      for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i++) {
          const fraction = perSide === 1 ? 0 : i / (perSide - 1) * 2 - 1;
          const hipX = side * width * .86, hipZ = fraction * length * .75;
          const homeX = side * cfg.spread * (1 - Math.abs(fraction) * .06);
          const homeZ = fraction * cfg.reach;
          const leg = {
            side, hipX, hipZ, homeX, homeZ, group: (i + (side > 0 ? 1 : 0)) % 2,
            footX: 0, footZ: 0, startX: 0, startZ: 0, targetX: 0, targetZ: 0, progress: 1,
            upper: part(root, 'wedge', cfg.armor, 0, 0, 0, 1, 1, 1),
            lower: part(root, 'wedge', cfg.armor, 0, 0, 0, 1, 1, 1),
            piston: part(root, 'box', 'steel', 0, 0, 0, 1, 1, 1),
            hip: part(root, 'cylinder', 'joint', hipX, cfg.height, hipZ, .33, .28, .33, Math.PI / 2),
            knee: part(root, 'cylinder', 'steel', 0, 0, 0, .29, .31, .29, Math.PI / 2),
            foot: part(root, 'wedge', 'steel', 0, 0, 0, isHeavy ? .62 : .27, .16, isHeavy ? .85 : .54)
          };
          legs.push(leg);
        }
      }
      const rig = { root, body, turret, barrel, muzzle, legs, cfg, kind, phase: 0, lastX: null, lastZ: null, airborne: false, landing: 0,
        dispose() { roots.delete(root); root.dispose(); }
      };
      roots.add(root);
      updateMech(rig, { x: 0, z: 0, angle: 0, aimAngle: 0, moving: false, speed: 0, jumpHeight: 0, recoil: 0, hp: 1, maxHp: 1 }, 0, 0);
      rig.lastX = null;
      return rig;
    }

    function updateMech(rig, entity, time, dt) {
      if (rig.motion) { updateImportedMech(rig, entity, dt); return; }
      const { root, body, turret, barrel, legs, cfg } = rig;
      const x = entity.x || 0, z = entity.z || 0, angle = entity.angle || 0;
      const jump = Math.max(0, entity.jumpHeight || 0);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const initial = rig.lastX === null;
      const dx = initial ? 0 : x - rig.lastX, dz = initial ? 0 : z - rig.lastZ;
      const distance = Math.hypot(dx, dz);
      const moving = !!entity.moving && distance > .0001;
      const air = jump > .04;
      if (rig.airborne && !air) rig.landing = .2;
      rig.landing = Math.max(0, rig.landing - dt);
      if (moving && !air) rig.phase += distance / (cfg.stride * 2);
      const velocityX = distance > .001 ? dx / distance : -sin;
      const velocityZ = distance > .001 ? dz / distance : -cos;
      const recoil = clamp(entity.recoil || 0, 0, 1);
      const bob = moving && !air ? Math.cos(rig.phase * tau * 2) * .035 : 0;
      const collapse = entity.hp <= 0 ? .38 : 0;
      const bodyY = cfg.height + bob - rig.landing * .8 - collapse;
      root.position.set(x, jump, z);
      root.rotation.y = angle;
      body.position.y = bodyY;
      body.rotation.x = -recoil * .045 + (air ? -.09 : 0);
      body.rotation.z = entity.hp <= 0 ? .1 : 0;
      turret.rotation.y = (Number.isFinite(entity.aimAngle) ? entity.aimAngle : angle) - angle;
      barrel.position.z = recoil * (rig.kind === 'heavy' ? .65 : .32);
      for (const leg of legs) {
        const hx = x + leg.homeX * cos + leg.homeZ * sin;
        const hz = z - leg.homeX * sin + leg.homeZ * cos;
        if (initial || (rig.airborne && !air) || distance > 5) {
          leg.footX = hx; leg.footZ = hz; leg.progress = 1;
        }
        if (!air && moving && leg.progress >= 1) {
          const stretch = Math.hypot(hx - leg.footX, hz - leg.footZ);
          const groupActive = Math.floor(rig.phase * 2) % 2 === leg.group;
          if (stretch > cfg.stride * (groupActive ? .38 : 1.15)) {
            leg.startX = leg.footX; leg.startZ = leg.footZ;
            leg.targetX = hx + velocityX * cfg.stride * .55;
            leg.targetZ = hz + velocityZ * cfg.stride * .55;
            leg.progress = 0;
          }
        }
        let lift = 0;
        if (!air && leg.progress < 1) {
          leg.progress = Math.min(1, leg.progress + dt * (rig.kind === 'heavy' ? 3.8 : 6.3));
          const p = leg.progress, smooth = p * p * (3 - 2 * p);
          leg.footX = leg.startX + (leg.targetX - leg.startX) * smooth;
          leg.footZ = leg.startZ + (leg.targetZ - leg.startZ) * smooth;
          lift = Math.sin(p * Math.PI) * (rig.kind === 'heavy' ? .35 : .43);
        }
        const rx = leg.footX - x, rz = leg.footZ - z;
        let fx = rx * cos - rz * sin, fz = rx * sin + rz * cos;
        let fy = .09 + lift - jump;
        if (air) {
          const tuck = clamp(jump / 1.1, 0, 1);
          fx = leg.homeX * (1 - .35 * tuck); fz = leg.homeZ * (1 - .28 * tuck) + .24 * tuck; fy = .09 + .49 * tuck;
        }
        const kneeX = leg.hipX + (fx - leg.hipX) * .57 + leg.side * .15;
        const kneeY = bodyY + (rig.kind === 'heavy' ? .33 : .55) + lift * .3;
        const kneeZ = leg.hipZ + (fz - leg.hipZ) * .4 + .14;
        const thickness = rig.kind === 'heavy' ? .52 : rig.kind === 'player' ? .34 : .29;
        link(leg.upper, leg.hipX, bodyY, leg.hipZ, kneeX, kneeY, kneeZ, thickness, thickness * 1.35);
        link(leg.lower, kneeX, kneeY, kneeZ, fx, fy + .1, fz, thickness * .81, thickness * 1.12);
        link(leg.piston, leg.hipX, bodyY - .1, leg.hipZ + .1, kneeX, kneeY - .19, kneeZ + .1, .085, .085);
        leg.hip.position.y = bodyY;
        leg.knee.position.set(kneeX, kneeY, kneeZ);
        leg.foot.position.set(fx, fy, fz - .1);
        leg.foot.rotation.x = air ? -.6 : -lift * .3;
      }
      rig.lastX = x; rig.lastZ = z; rig.airborne = air;
    }

    function createEnvironment(obstacles) {
      const root = node('industrial-sector');
      roots.add(root);
      if (!materials.asphalt.albedoTexture) {
        for (const [name, u, v] of [['asphalt', 31, 26.5], ['road', 24.75, 3.75], ['roadCross', 3, 20.5]]) {
          const diffuse = new B.Texture('assets/3d/asphalt_02_diff_1k.jpg', scene);
          const normal = new B.Texture('assets/3d/asphalt_02_nor_gl_1k.jpg', scene);
          for (const texture of [diffuse, normal]) { texture.uScale = u; texture.vScale = v; texture.uOffset = -u / 2; texture.vOffset = -v / 2; texture.anisotropicFilteringLevel = 4; textures.push(texture); }
          normal.gammaSpace = false; normal.level = .35;
          materials[name].albedoTexture = diffuse;
          materials[name].bumpTexture = normal;
        }
      }
      const ground = part(root, 'box', 'asphalt', 0, -.2, 0, 106, .35, 124);
      ground.isPickable = true;
      ground.metadata = { ground: true };
      part(root, 'box', 'road', 0, -.018, 0, 15, .015, 99);
      part(root, 'box', 'roadCross', 0, -.015, -10, 82, .015, 12);
      for (let z = -46; z <= 46; z += 6) {
        part(root, 'box', 'stripe', -.13, .005, z, .18, .012, 2.4);
        for (const x of [-7.2, 7.2]) part(root, 'box', 'concreteTop', x, -.002, z, .12, .013, 4.3);
      }
      for (const x of [-30.5, -28.4]) part(root, 'box', 'steel', x, .04, 0, .12, .11, 104);
      for (let z = -50; z <= 50; z += 2.8) part(root, 'box', 'rust', -29.45, -.002, z, 3.5, .09, .26);
      const obstacleRigs = new Map();
      for (const obstacle of obstacles || []) {
        const group = node('cover-' + obstacle.id, root);
        group.position.set(obstacle.x, 0, obstacle.z);
        const w = obstacle.w, d = obstacle.d, h = obstacle.h;
        const mesh = part(group, 'box', 'concrete', 0, h / 2, 0, w, h, d);
        mesh.isPickable = true;
        mesh.metadata = { obstacleId: obstacle.id };
        part(group, 'box', 'concreteTop', 0, h + .025, 0, w + .06, .07, d + .06);
        const segments = Math.max(1, Math.floor(w / 3.5));
        for (let i = 0; i <= segments; i++) {
          const x = -w / 2 + .15 + (w - .3) * i / segments;
          part(group, 'box', 'steel', x, h * .48, -d / 2 - .025, .085, h * .72, .055);
        }
        if (obstacle.type === 'low') {
          for (let i = -1; i <= 1; i++) part(group, 'box', 'stripe', i * .48, h * .65, -d / 2 - .034, .24, Math.min(.45,h * .35), .014, -.38);
        } else {
          for (const side of [-1, 1]) part(group, 'box', 'concrete', side * (w / 2 - .3), h / 2, 0, .64, h + .35, d + .45);
        }
        for (const side of [-1, 1]) {
          part(group, 'box', 'rust', 0, h * .11, side * (d / 2 + .009), w * .94, Math.min(.2, h * .17), .012);
          for (let i = 0; i < Math.max(1, Math.floor(d / 3)); i++) {
            part(group, 'box', 'stain', side * (w / 2 + .009), h * .33, -d / 2 + .7 + i * 2.5, .012, h * .42, .11 + i * .035);
          }
        }
        obstacleRigs.set(obstacle.id, group);
      }
      for (const x of [-45, 45]) {
        for (const z of [-39, -17, 10, 35]) {
          part(root, 'box', 'concrete', x, 3.6, z, 6, 7.2, 12);
          part(root, 'box', 'steel', x, 7.3, z, 6.6, .25, 12.6);
          for (let j = -1; j <= 1; j++) part(root, 'box', 'joint', x - Math.sign(x) * 3.015, 4.2, z + j * 3.2, .045, 1.45, 1.8);
          part(root, 'box', 'rust', x - Math.sign(x) * 2.8, 7.9, z + 2, .24, 1.3, .24);
        }
      }
      for (const x of [-33, -22]) {
        part(root, 'cylinder', 'rust', x, 4.3, -55, 4.7, 8.6, 4.7);
        part(root, 'cylinder', 'steel', x, 8.75, -55, 5, .28, 5);
        part(root, 'cylinder', 'joint', x, 10.4, -55, 1.2, 3.1, 1.2);
      }
      for (const x of [-10, 11]) {
        part(root, 'box', 'rust', x, 6, -51, .65, 12, .8);
        part(root, 'box', 'steel', x, 6.3, -51, .2, 12.7, .3, .06);
      }
      part(root, 'box', 'rust', .5, 11.8, -51, 24, .8, 1.05);
      for (let i = 0; i < 14; i++) part(root, 'box', 'steel', -9 + i * 1.45, 11, -51, .13, 1.2, .35, i % 2 ? .8 : -.8);
      for (const x of [-37, 37]) {
        part(root, 'box', 'steel', x, 4.2, -1, .18, 8.4, .18);
        part(root, 'box', 'steel', x - Math.sign(x) * .75, 8.3, -1, 1.7, .14, .2);
        part(root, 'box', 'stripe', x - Math.sign(x) * 1.3, 8.18, -1, .66, .16, .42);
      }
      for (const side of [-1, 1]) {
        for (let i = 0; i < 16; i++) {
          const x = side * (41.3 + (i % 3) * .65), z = -44 + i * 5.8;
          const stone = part(root, 'wedge', i % 3 ? 'concrete' : 'concreteTop', x, .18 + (i % 3) * .07, z, .7 + (i % 4) * .29, .4 + (i % 3) * .16, .75 + (i % 3) * .28, (i % 3 - 1) * .17);
          stone.rotation.y = i * 1.7;
          if (i % 2 === 0) {
            const stain = part(root, 'wedge', 'stain', x, -.009, z + .4, 3.6, .014, 2.4);
            stain.rotation.y = i * .83;
          }
        }
        for (let i = 0; i < 8; i++) {
          const stone = part(root, 'wedge', 'concrete', -35 + i * 9.5, .27, side * (50 + (i % 2)), 1.1 + (i % 3) * .4, .6, 1.1, .16);
          stone.rotation.y = i * 2.1;
        }
      }
      return { root, ground, obstacles: obstacleRigs, dispose() { roots.delete(root); root.dispose(); } };
    }

    async function loadPlayerMotion() {
      const base = 'art-direction/86-reference/probe-assets/';
      const response = await fetch(base + 's52-juggernaut-motion.json');
      if (!response.ok) throw new Error('M1A4 動作資料未能載入');
      const motion = await response.json();
      const container = await B.SceneLoader.LoadAssetContainerAsync(base, 's52-juggernaut-motion.glb', scene);
      playerAsset = { container, motion };
      return motion;
    }

    function createPlayerMotion(id) {
      if (!playerAsset) throw new Error('M1A4 尚未載入');
      const entries = playerAsset.container.instantiateModelsToScene(name => id + '/' + name, false);
      const root = node(id), facing = node(id + '/facing', root);
      for (const item of entries.rootNodes) item.parent = facing;
      const transforms = root.getDescendants().filter(n => n.position && n.rotationQuaternion);
      const find = name => root.getDescendants().find(n => n.name === id + '/' + name);
      const turret = find('Turret'), muzzle = find('muzzle_anchor');
      if (!turret || !muzzle) { entries.dispose(); root.dispose(); throw new Error('M1A4 缺少砲架或砲口節點'); }
      root.computeWorldMatrix(true); root.getDescendants().forEach(n => n.computeWorldMatrix && n.computeWorldMatrix(true));
      facing.rotation.y = muzzle.getAbsolutePosition().z > turret.getAbsolutePosition().z ? Math.PI : 0;
      const groups = {};
      for (const group of entries.animationGroups) { group.stop(); groups[group.name.slice(id.length + 1)] = group; }
      root.getChildMeshes().forEach(m => { m.isPickable = false; m.receiveShadows = true; });
      const rig = { root, turret, muzzle, entries, motion: playerAsset.motion, groups, transforms,
        turretRest: turret.rotationQuaternion.clone(), lastX: null, lastZ: null, phase: 0, clip: null,
        blend: 1, fromPose: [], recoilTime: .5, previousRecoil: 0,
        dispose() { roots.delete(root); entries.dispose(); root.dispose(); } };
      roots.add(root);
      return rig;
    }

    function updateImportedMech(rig, entity, dt) {
      const distance = rig.lastX === null ? 0 : Math.hypot(entity.x - rig.lastX, entity.z - rig.lastZ);
      const air = entity.jumpHeight > .001;
      const clip = air ? 'vault' : entity.moving && distance > .0001 ? 'trot' : 'idle';
      if (clip !== rig.clip) {
        rig.fromPose = rig.transforms.map(n => ({ p: n.position.clone(), q: n.rotationQuaternion.clone() }));
        if (rig.clip) rig.groups[rig.clip].stop();
        rig.clip = clip; rig.blend = 0;
        rig.groups[clip].start(true); rig.groups[clip].pause();
      }
      if (clip === 'trot') rig.phase = (rig.phase + distance / rig.motion.trot.forwardTravelPerCycle) % 1;
      const group = rig.groups[clip];
      const progress = clip === 'vault' ? clamp((entity.leapTime || 0) / .76, 0, 1) : clip === 'trot' ? rig.phase : 0;
      group.goToFrame(group.from + (group.to - group.from) * progress);
      rig.blend = Math.min(1, rig.blend + dt / .18);
      if (rig.blend < 1) rig.transforms.forEach((n, i) => {
        n.position.copyFrom(B.Vector3.Lerp(rig.fromPose[i].p, n.position, rig.blend));
        n.rotationQuaternion.copyFrom(B.Quaternion.Slerp(rig.fromPose[i].q, n.rotationQuaternion, rig.blend));
      });
      if ((entity.recoil || 0) > rig.previousRecoil + .1) {
        rig.recoilTime = 0; rig.groups.recoil.start(false); rig.groups.recoil.pause();
      }
      rig.recoilTime = Math.min(.5, rig.recoilTime + dt);
      rig.groups.recoil.goToFrame(rig.groups.recoil.from + (rig.groups.recoil.to - rig.groups.recoil.from) * rig.recoilTime / .5);
      rig.previousRecoil = entity.recoil || 0;
      rig.root.position.set(entity.x, entity.jumpHeight || 0, entity.z);
      rig.root.rotation.y = entity.angle || 0;
      rig.turret.rotationQuaternion.copyFrom(rig.turretRest.multiply(B.Quaternion.RotationAxis(B.Axis.Y, (entity.aimAngle || 0) - (entity.angle || 0))));
      rig.lastX = entity.x; rig.lastZ = entity.z;
    }

    return { createMech, createEnvironment, updateMech, loadPlayerMotion, createPlayerMotion, dispose() {
      for (const root of roots) root.dispose();
      roots.clear();
      for (const mesh of sources.values()) mesh.dispose();
      for (const mat of Object.values(materials)) mat.dispose();
      for (const texture of textures) texture.dispose();
      textures.length = 0;
      sources.clear();
      if (playerAsset) { playerAsset.container.dispose(); playerAsset = null; }
    } };
  }

  global.SortieModels = { create };
})(typeof window !== 'undefined' ? window : globalThis);
