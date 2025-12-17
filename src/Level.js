import * as THREE from 'three';

export class Level {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.pool = [];
        this.spawnZ = 10; // Start spawning ahead
        this.chunkSize = 10; 
        
        // Materials
        this.material = new THREE.MeshStandardMaterial({ 
            color: 0x888899, // Concrete-ish
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });
        
        this.holeMaterial = new THREE.MeshStandardMaterial({
            color: 0x220000,
            roughness: 1.0
        });

        // Initialize starting platform
        this.addPlatform(0, 0, 0, 10, 40); // Safe start zone
        
        this.tileColor1 = 0x666677;
        this.tileColor2 = 0x555566;
    }

    addPlatform(x, y, z, width, depth) {
        // Check pool
        let mesh = this.pool.pop();
        if (!mesh) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geometry, this.material.clone());
            mesh.receiveShadow = true;
        } else {
            mesh.visible = true;
        }

        // Scale and position
        mesh.scale.set(width, 1, depth);
        mesh.position.set(x, y, z);
        
        // Checkerboard effect for "RUN" look
        const color = (Math.floor(z / 10) % 2 === 0) ? this.tileColor1 : this.tileColor2;
        mesh.material.color.setHex(color);

        this.scene.add(mesh);
        
        this.platforms.push({
            mesh: mesh,
            x: x,
            y: y,
            z: z,
            width: width,
            depth: depth,
            active: true
        });
    }

    update(playerZ) {
        // Remove platforms behind player
        const removeThreshold = playerZ + 20; 
        
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.z > removeThreshold) {
                // Recycle
                p.mesh.visible = false;
                this.scene.remove(p.mesh); // Remove from scene to update collision list efficiently?
                // Actually keep in scene but hide?
                // For raycasting optimization usually we want a clean list.
                // Simple pool:
                this.pool.push(p.mesh);
                this.platforms.splice(i, 1);
            }
        }

        // Spawn new platforms ahead
        const spawnThreshold = playerZ - 60;
        while (this.spawnZ > spawnThreshold) {
            this.spawnPattern();
        }
    }

    spawnPattern() {
        // Generate a random pattern
        // 3 Lanes: -3, 0, 3
        
        const laneWidth = 3;
        const length = 10 + Math.random() * 10;
        const gap = 2 + Math.random() * 4;
        
        const type = Math.random();
        
        if (type < 0.6) {
            // Basic floor on all lanes, maybe one missing
            const missingLane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
            
            for (let lane = -1; lane <= 1; lane++) {
                if (Math.random() > 0.2 || lane !== missingLane) {
                    this.addPlatform(lane * laneWidth, 0, this.spawnZ - length/2, 2.8, length);
                }
            }
        } else if (type < 0.8) {
            // Steps / Stairs
            // Not implementing physics for stairs yet, keep flat
             this.addPlatform(0, 0, this.spawnZ - length/2, 2.8, length);
        } else {
            // Split path
            this.addPlatform(-laneWidth, 0, this.spawnZ - length/2, 2.8, length);
            this.addPlatform(laneWidth, 0, this.spawnZ - length/2, 2.8, length);
        }

        this.spawnZ -= (length + gap);
    }
    
    reset() {
        // Clear all active
        this.platforms.forEach(p => {
            p.mesh.visible = false;
            this.pool.push(p.mesh);
            this.scene.remove(p.mesh);
        });
        this.platforms = [];
        this.spawnZ = 10;
        this.addPlatform(0, 0, 0, 10, 40);
    }
}

import * as THREE from 'three';

export class Level {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.pool = [];
        this.spawnZ = -20; // Start spawning after the initial platform
        
        // Classic "Run" style colors
        this.colorA = 0x666666;
        this.colorB = 0x555555;
        this.material = new THREE.MeshStandardMaterial({ 
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        // Initial safe zone
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
        
        // Checkerboard tint
        const tileIndex = Math.floor(Math.abs(z) / 10);
        mesh.material.color.setHex(tileIndex % 2 === 0 ? this.colorA : this.colorB);
        
        // Add to active list
        this.platforms.push({
            mesh, x, y, z, width, depth
        });
    }

    update(playerZ) {
        // Remove old platforms
        // Player moves -Z. Anything > playerZ + 20 is behind.
        const removeThreshold = playerZ + 30;
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.z > removeThreshold) {
                p.mesh.visible = false;
                this.pool.push(p.mesh);
                this.platforms.splice(i, 1);
            }
        }

        // Spawn new platforms ahead
        // Player moves -Z. Spawn anything > playerZ - 80
        const spawnThreshold = playerZ - 100;
        while (this.spawnZ > spawnThreshold) {
            this.spawnPattern();
        }
    }

    spawnPattern() {
        // 3 Lanes: -3, 0, 3
        const laneDist = 3;
        const length = 15 + Math.random() * 15;
        const gap = 3 + Math.random() * 5;
        
        const r = Math.random();
        
        // Logic to determine where to place tiles
        // Center of the new tile is:
        const zPos = this.spawnZ - length / 2;

        if (r < 0.5) {
            // Main path with side gaps
            this.addPlatform(0, 0, zPos, 2.8, length);
            if (Math.random() > 0.5) this.addPlatform(-laneDist, 0, zPos, 2.8, length);
            if (Math.random() > 0.5) this.addPlatform(laneDist, 0, zPos, 2.8, length);
        } else if (r < 0.8) {
            // Split paths (left/right only)
            this.addPlatform(-laneDist, 0, zPos, 2.8, length);
            this.addPlatform(laneDist, 0, zPos, 2.8, length);
        } else {
            // Just one random lane
            const lane = (Math.floor(Math.random() * 3) - 1) * laneDist;
            this.addPlatform(lane, 0, zPos, 2.8, length);
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

