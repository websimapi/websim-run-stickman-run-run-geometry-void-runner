import * as THREE from 'three';

export class Level {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.pool = [];
        this.spawnZ = -20; 
        
        // Colors for the "Run" aesthetic (Grey tiles)
        this.colorA = 0x666666;
        this.colorB = 0x555555;
        this.material = new THREE.MeshStandardMaterial({ 
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        this.radius = 8; // Tunnel radius

        // Start platform - initially hidden for menu
        // x param is now ANGLE in radians
        this.addPlatform(0, 0, 0, 3, 40); 
        this.platforms[0].mesh.visible = false;
    }

    addPlatform(angle, yOffset, z, widthScale, depth) {
        let mesh = this.pool.pop();
        if (!mesh) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geometry, this.material.clone());
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        } else {
            mesh.visible = true;
        }

        // Width logic: widthScale corresponds to arc length roughly
        // Actual mesh scale width
        const meshWidth = widthScale * 2.0; 
        const height = 1; // Platform thickness
        
        mesh.scale.set(meshWidth, height, depth);
        
        // Polar to Cartesian
        // We run on inside, so position is radius from center
        // yOffset is height from the "floor" (wall)
        const r = this.radius - (height/2) - yOffset;
        
        const px = r * Math.sin(angle);
        const py = -r * Math.cos(angle);
        
        mesh.position.set(px, py, z);
        
        // Rotate to align with cylinder surface
        // Normal points to center (0,0,z)
        mesh.rotation.set(0, 0, -angle);
        
        // Checkerboard Pattern
        const tileIndex = Math.floor(Math.abs(z) / 10);
        mesh.material.color.setHex(tileIndex % 2 === 0 ? this.colorA : this.colorB);
        
        this.platforms.push({ mesh, angle, y: yOffset, z, width: widthScale, depth, r });
    }

    update(playerZ) {
        // Remove old
        const removeThreshold = playerZ + 30;
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.z > removeThreshold) {
                p.mesh.visible = false;
                this.pool.push(p.mesh);
                this.platforms.splice(i, 1);
            }
        }

        // Spawn new
        const spawnThreshold = playerZ - 120;
        while (this.spawnZ > spawnThreshold) {
            this.spawnPattern();
        }
    }

    spawnPattern() {
        // Angles instead of lanes
        // Circumference at r=8 is ~50. 
        // 0 angle is bottom. PI is top.
        
        const length = 15 + Math.random() * 20;
        const gap = 3 + Math.random() * 6;
        const zPos = this.spawnZ - length / 2;
        
        const r = Math.random();
        
        // Base angles (radians)
        const center = 0;
        const left = -0.5;
        const right = 0.5;
        const top = Math.PI;
        const sideL = -1.5;
        const sideR = 1.5;

        // Helper to randomize angle slightly
        const randA = (base) => base + (Math.random() * 0.2 - 0.1);

        if (r < 0.3) {
            // Floor path
            this.addPlatform(randA(center), 0, zPos, 1.5, length);
            if (Math.random() > 0.5) this.addPlatform(randA(left), 0, zPos, 1.5, length);
            if (Math.random() > 0.5) this.addPlatform(randA(right), 0, zPos, 1.5, length);
        } else if (r < 0.6) {
            // Ring / Tunnel section (obstacles all around)
            const count = 4 + Math.floor(Math.random() * 4);
            for(let i=0; i<count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this.addPlatform(angle + (this.spawnZ*0.1), 0, zPos, 1.5, length); // Twist effect
            }
        } else if (r < 0.8) {
            // Two sides
            this.addPlatform(randA(sideL), 0, zPos, 1.5, length);
            this.addPlatform(randA(sideR), 0, zPos, 1.5, length);
            if (Math.random() > 0.5) this.addPlatform(randA(top), 0, zPos, 1.5, length);
        } else {
            // Spiral stepping stones
            const steps = 5;
            const stepLen = length / steps;
            let currentZ = this.spawnZ;
            let currentAng = Math.random() * Math.PI * 2;
            
            for(let i=0; i<steps; i++) {
                currentZ -= stepLen;
                currentAng += 0.5;
                this.addPlatform(currentAng, 0, currentZ, 1.2, stepLen * 0.9);
            }
            // Skip the standard Z decrement since we handled it
            this.spawnZ = currentZ - gap;
            return; 
        }

        this.spawnZ -= (length + gap);
    }

    reset() {
        this.platforms.forEach(p => {
            p.mesh.visible = false;
            this.pool.push(p.mesh);
        });
        this.platforms = [];
        this.spawnZ = -20;
        this.addPlatform(0, 0, 0, 3, 40);
    }

    start() {
        // Ensure start platform is visible
        if (this.platforms.length > 0) {
            this.platforms[0].mesh.visible = true;
        }
    }
}

