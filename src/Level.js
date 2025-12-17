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

        // Start platform
        this.addPlatform(0, 0, 0, 10, 40); 
    }

    addPlatform(x, y, z, width, depth) {
        let mesh = this.pool.pop();
        if (!mesh) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geometry, this.material.clone());
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        } else {
            mesh.visible = true;
        }

        mesh.scale.set(width, 1, depth);
        mesh.position.set(x, y, z);
        
        // Checkerboard Pattern
        const tileIndex = Math.floor(Math.abs(z) / 10);
        mesh.material.color.setHex(tileIndex % 2 === 0 ? this.colorA : this.colorB);
        
        this.platforms.push({ mesh, x, y, z, width, depth });
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
        const laneDist = 3;
        const length = 15 + Math.random() * 20;
        const gap = 3 + Math.random() * 6;
        
        // Calculate position
        const zPos = this.spawnZ - length / 2;
        const r = Math.random();

        if (r < 0.4) {
            // Standard
            this.addPlatform(0, 0, zPos, 2.8, length);
            if (Math.random() > 0.4) this.addPlatform(-laneDist, 0, zPos, 2.8, length);
            if (Math.random() > 0.4) this.addPlatform(laneDist, 0, zPos, 2.8, length);
        } else if (r < 0.7) {
            // Split
            this.addPlatform(-laneDist, 0, zPos, 2.8, length);
            this.addPlatform(laneDist, 0, zPos, 2.8, length);
        } else if (r < 0.9) {
            // Single random lane
            const lanes = [-laneDist, 0, laneDist];
            const l = lanes[Math.floor(Math.random() * 3)];
            this.addPlatform(l, 0, zPos, 2.8, length);
        } else {
            // Stairs pattern (flat for now, just gaps)
            this.addPlatform(0, 0, zPos, 2.8, length * 0.5);
            this.spawnZ -= 2; // Extra gap
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
        this.addPlatform(0, 0, 0, 10, 40);
    }
}

