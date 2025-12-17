import * as THREE from 'three';
import { createLimb, createJoint } from './Utils.js';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 5, 0); // Start high to drop in
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        this.isRunning = true;
        
        // Rig parts
        this.mesh = new THREE.Group();
        this.parts = {};
        
        this.color = 0xffee00; // Bright yellow stickman like classic flash games or warning signs
        this.jointColor = 0x333333;

        this.initRig();
        this.scene.add(this.mesh);
        
        // Animation state
        this.time = 0;
        this.runSpeed = 15;
        this.lane = 0; // -1 (left), 0 (center), 1 (right)
        this.laneWidth = 3;
        this.targetX = 0;
        
        // Physics constants
        this.gravity = -30;
        this.jumpForce = 12;
    }

    initRig() {
        const bodyColor = this.color;
        
        // Hips (Root of body)
        this.parts.hips = new THREE.Group();
        this.parts.hips.position.y = 1.0;
        this.mesh.add(this.parts.hips);

        // Torso
        const torso = createLimb(0.15, 0.6, bodyColor);
        torso.pivot.position.y = 0; // Start at hips
        torso.pivot.rotation.z = Math.PI; // Point up? No, default cylinder is vertical.
        // Actually capsule is vertical centered. 
        // createLimb moves mesh y to -length/2. 
        // So pivot is at top.
        // We want torso to go UP from hips.
        torso.mesh.position.y = 0.3; // Offset up
        this.parts.hips.add(torso.pivot);
        this.parts.torso = torso.pivot;

        // Head
        const head = createJoint(0.25, bodyColor);
        head.position.y = 0.7; // On top of torso
        this.parts.torso.add(head);

        // Arms
        this.parts.armL = this.createArm(-1);
        this.parts.armR = this.createArm(1);
        
        // Shoulder position relative to torso top
        const shoulderY = 0.55;
        const shoulderX = 0.2;
        
        this.parts.armL.upper.position.set(-shoulderX, shoulderY, 0);
        this.parts.armR.upper.position.set(shoulderX, shoulderY, 0);
        
        this.parts.torso.add(this.parts.armL.upper);
        this.parts.torso.add(this.parts.armR.upper);

        // Legs
        this.parts.legL = this.createLeg(-1);
        this.parts.legR = this.createLeg(1);
        
        const hipX = 0.1;
        this.parts.legL.upper.position.set(-hipX, 0, 0);
        this.parts.legR.upper.position.set(hipX, 0, 0);
        
        this.parts.hips.add(this.parts.legL.upper);
        this.parts.hips.add(this.parts.legR.upper);
    }

    createArm(side) {
        const upperLen = 0.4;
        const lowerLen = 0.4;
        const width = 0.08;
        
        const upper = createLimb(width, upperLen, this.color);
        const lower = createLimb(width, lowerLen, this.color);
        const joint = createJoint(width * 1.2, this.jointColor);
        
        // Connect lower to upper
        lower.pivot.position.y = -upperLen;
        joint.position.y = -upperLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        
        return { upper: upper.pivot, lower: lower.pivot };
    }

    createLeg(side) {
        const upperLen = 0.5;
        const lowerLen = 0.5;
        const width = 0.1;
        
        const upper = createLimb(width, upperLen, this.color);
        const lower = createLimb(width, lowerLen, this.color);
        const joint = createJoint(width * 1.2, this.jointColor);
        
        // Connect lower to upper
        lower.pivot.position.y = -upperLen;
        joint.position.y = -upperLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        
        return { upper: upper.pivot, lower: lower.pivot };
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            
            // Play sound
            const jumpSound = new Audio('jump.mp3');
            jumpSound.volume = 0.3;
            jumpSound.play().catch(e => {});
        }
    }

    moveLane(direction) {
        this.lane += direction;
        this.lane = Math.max(-1, Math.min(1, this.lane));
        this.targetX = this.lane * this.laneWidth;
    }

    update(dt, platforms) {
        this.time += dt * this.runSpeed;

        // Physics: Gravity
        this.velocity.y += this.gravity * dt;
        this.position.y += this.velocity.y * dt;

        // Physics: Lane movement (Lerp)
        const laneSpeed = 10;
        this.position.x += (this.targetX - this.position.x) * laneSpeed * dt;

        // Collision Detection (Simple Raycast/Box check)
        this.checkCollisions(platforms);

        // Update Mesh Position
        this.mesh.position.copy(this.position);

        // Animate Rig
        this.animateRunCycle();
        
        // Kill check
        if (this.position.y < -10) {
            return false; // Dead
        }
        return true; // Alive
    }

    checkCollisions(platforms) {
        // Simple AABB ground check
        // Player radius roughly 0.3
        // We only check if feet intersect with a platform surface
        
        // Assume platforms are axis aligned boxes at various Z positions
        // Player is moving in Z? No, world moves around player usually in endless runners,
        // BUT for physics it's easier if player moves forward.
        // Let's have player Z increase.
        
        // Oh wait, in endless runners usually player stays at Z=0 locally, or world scrolls.
        // Let's move the player forward in Z.
        
        this.position.z -= 10 * (1/60); // Constant forward run speed (simulated in world update, but let's track absolute distance)
        
        // Actually, let's keep player Z at 0 and move world. 
        // No, easier for camera to follow player moving through static world.
        // Let's implement: Player moves -Z.
        const forwardSpeed = 12;
        this.position.z -= forwardSpeed * (1/60); // approx dt

        this.isGrounded = false;

        // Check platforms
        // Only check platforms near the player
        for (const platform of platforms) {
            if (this.position.z < platform.z + platform.depth/2 && 
                this.position.z > platform.z - platform.depth/2) {
                
                // Z Match, check X
                const pWidth = platform.width / 2;
                if (this.position.x > platform.x - pWidth && 
                    this.position.x < platform.x + pWidth) {
                    
                    // X Match, check Y
                    // Platform surface is at platform.y + platform.height/2
                    const surfaceY = platform.y + 0.5; // BoxGeometry height is 1 usually in my generator
                    
                    // If player feet (y roughly 0 relative to pivot, pivot is at 1.0)
                    // Mesh origin is at 0, hips at 1.0. Legs go down 1.0 total.
                    // So feet are at Mesh Origin (0,0,0) relative to this.position.
                    
                    if (this.position.y <= surfaceY && this.position.y > surfaceY - 0.5) {
                        if (this.velocity.y <= 0) {
                            this.position.y = surfaceY;
                            this.velocity.y = 0;
                            this.isGrounded = true;
                        }
                    }
                }
            }
        }
    }

    animateRunCycle() {
        const t = this.time;
        
        if (this.isGrounded) {
            // Run Animation
            // Arms opposite to legs
            // Left Leg
            this.parts.legL.upper.rotation.x = Math.sin(t) * 0.8;
            this.parts.legL.lower.rotation.x = Math.max(0, Math.sin(t - Math.PI/2) * 1.5); // Knees bend back

            // Right Leg
            this.parts.legR.upper.rotation.x = Math.sin(t + Math.PI) * 0.8;
            this.parts.legR.lower.rotation.x = Math.max(0, Math.sin(t + Math.PI - Math.PI/2) * 1.5);

            // Arms (Swing opposite)
            this.parts.armL.upper.rotation.x = Math.sin(t + Math.PI) * 0.6;
            this.parts.armL.lower.rotation.x = -Math.abs(Math.sin(t) * 0.5) - 0.5; // Elbows always bent a bit

            this.parts.armR.upper.rotation.x = Math.sin(t) * 0.6;
            this.parts.armR.lower.rotation.x = -Math.abs(Math.sin(t + Math.PI) * 0.5) - 0.5;
            
            // Bobbing
            this.parts.hips.position.y = 1.0 + Math.abs(Math.sin(t*2)) * 0.1;
            
            // Lean forward
            this.mesh.rotation.x = 0.2;
        } else {
            // Jump Pose
            // Legs spread or tucked
            this.parts.legL.upper.rotation.x = 0.5;
            this.parts.legL.lower.rotation.x = 0.2;
            this.parts.legR.upper.rotation.x = -0.2;
            this.parts.legR.lower.rotation.x = 0.5;
            
            // Arms up helps momentum visually
            this.parts.armL.upper.rotation.x = -2.5;
            this.parts.armR.upper.rotation.x = -2.5;
            
            this.mesh.rotation.x = 0;
        }
    }
}

import * as THREE from 'three';
import { createLimb, createJoint } from './Utils.js';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        this.mesh = new THREE.Group();
        this.parts = {};
        this.scene.add(this.mesh);
        
        this.initRig();
        
        this.time = 0;
        this.lane = 0;
        this.laneWidth = 3;
        this.targetX = 0;
        
        // Physics
        this.gravity = -40;
        this.jumpForce = 14;
        this.runSpeed = 16;
    }

    initRig() {
        const color = 0xFFD700; // Gold/Yellow
        const jointColor = 0x222222;

        // Hips
        this.parts.hips = new THREE.Group();
        this.parts.hips.position.y = 1.0;
        this.mesh.add(this.parts.hips);

        // Torso
        const torso = createLimb(0.12, 0.5, color);
        torso.pivot.position.y = 0.35; // Hips to waist
        this.parts.hips.add(torso.pivot);
        this.parts.torso = torso.pivot;

        // Head
        const head = createJoint(0.22, color);
        head.position.y = 0.55; // relative to torso top? No, torso pivot is at bottom?
        // Wait, createLimb(0.5): pivot at top (0,0). mesh goes down to -0.5.
        // So torso.pivot needs to be placed at shoulders essentially?
        // Let's rethink.
        // Standard: Hips -> Spine -> Shoulders.
        // My createLimb puts pivot at the TOP of the limb.
        // So if I want a torso going UP from hips:
        // That's inverted for createLimb.
        // I'll just use a cylinder mesh for torso manually to avoid confusion or rotate createLimb 180.
        
        // Let's rotate the torso 180 so pivot is at hips (bottom).
        torso.pivot.rotation.z = Math.PI; 
        torso.pivot.position.y = 0; // At hips
        // Now torso goes UP from 0 to 0.5.
        
        // Head needs to be at Hips + 0.5 + Neck.
        // Actually since I added torso to hips, I can just position head relative to hips.
        head.position.set(0, 0.65, 0);
        this.parts.hips.add(head);

        // Arms (Shoulders)
        this.parts.armL = this.createArm(-1, color, jointColor);
        this.parts.armR = this.createArm(1, color, jointColor);
        
        const shoulderY = 0.5;
        const shoulderX = 0.2;
        this.parts.armL.upper.position.set(-shoulderX, shoulderY, 0);
        this.parts.armR.upper.position.set(shoulderX, shoulderY, 0);
        
        this.parts.hips.add(this.parts.armL.upper);
        this.parts.hips.add(this.parts.armR.upper);

        // Legs
        this.parts.legL = this.createLeg(-1, color, jointColor);
        this.parts.legR = this.createLeg(1, color, jointColor);
        
        const hipX = 0.1;
        this.parts.legL.upper.position.set(-hipX, 0, 0);
        this.parts.legR.upper.position.set(hipX, 0, 0);
        
        this.parts.hips.add(this.parts.legL.upper);
        this.parts.hips.add(this.parts.legR.upper);
    }

    createArm(side, color, jointColor) {
        const uLen = 0.35, lLen = 0.35;
        const upper = createLimb(0.08, uLen, color);
        const lower = createLimb(0.08, lLen, color);
        const joint = createJoint(0.1, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    createLeg(side, color, jointColor) {
        const uLen = 0.45, lLen = 0.45;
        const upper = createLimb(0.1, uLen, color);
        const lower = createLimb(0.1, lLen, color);
        const joint = createJoint(0.12, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            new Audio('jump.mp3').play().catch(()=>{});
        }
    }

    moveLane(dir) {
        this.lane = Math.max(-1, Math.min(1, this.lane + dir));
        this.targetX = this.lane * this.laneWidth;
    }

    update(dt, platforms, isRunning) {
        // Position Smoothing
        this.position.x += (this.targetX - this.position.x) * 10 * dt;

        if (isRunning) {
            this.time += dt * this.runSpeed;
            
            // Forward movement
            this.position.z -= 15 * dt;

            // Gravity
            this.velocity.y += this.gravity * dt;
            this.position.y += this.velocity.y * dt;

            this.checkCollisions(platforms);
            
            this.animateRun();
        } else {
            this.time += dt * 2; // Slow breathe
            this.animateIdle();
        }

        this.mesh.position.copy(this.position);
        
        // Death check
        return this.position.y > -20;
    }

    checkCollisions(platforms) {
        this.isGrounded = false;
        
        // Find platform under feet
        // Feet are roughly at position.y (since hips are at +1.0 and legs are ~0.9 long)
        // Actually, hips at 1.0, legs 0.45+0.45 = 0.9. So feet at 0.1 relative to mesh origin.
        // Mesh origin is at this.position.
        // So feet world Y = this.position.y + 0.1.
        
        // Platform surface is at p.y + 0.5.
        // If feet < surface, and we are falling, land.
        
        const feetY = this.position.y; 
        const feetZ = this.position.z;
        const feetX = this.position.x;

        for (const p of platforms) {
            // Check Z overlap
            if (feetZ < p.z + p.depth/2 && feetZ > p.z - p.depth/2) {
                // Check X overlap
                if (feetX > p.x - p.width/2 && feetX < p.x + p.width/2) {
                    const surfaceY = p.y + 0.5;
                    // Check Y
                    if (feetY <= surfaceY && feetY > surfaceY - 1.0) {
                        if (this.velocity.y <= 0) {
                            this.velocity.y = 0;
                            this.position.y = surfaceY;
                            this.isGrounded = true;
                            return;
                        }
                    }
                }
            }
        }
    }

    animateRun() {
        const t = this.time;
        
        if (this.isGrounded) {
            this.parts.hips.position.y = 1.0 + Math.sin(t*2) * 0.05;
            this.mesh.rotation.x = 0.2; // Lean forward
            
            // Arms
            this.parts.armL.upper.rotation.x = Math.sin(t + Math.PI) * 0.8;
            this.parts.armL.lower.rotation.x = -1.0;
            this.parts.armR.upper.rotation.x = Math.sin(t) * 0.8;
            this.parts.armR.lower.rotation.x = -1.0;

            // Legs
            this.parts.legL.upper.rotation.x = Math.sin(t) * 1.0;
            this.parts.legL.lower.rotation.x = Math.max(0, Math.sin(t - 1.5) * 2.0);
            
            this.parts.legR.upper.rotation.x = Math.sin(t + Math.PI) * 1.0;
            this.parts.legR.lower.rotation.x = Math.max(0, Math.sin(t + Math.PI - 1.5) * 2.0);
        } else {
            // Jump pose
            this.parts.legL.upper.rotation.x = 0.8;
            this.parts.legL.lower.rotation.x = 0.5;
            this.parts.legR.upper.rotation.x = -0.5;
            this.parts.legR.lower.rotation.x = 0.5;
            this.mesh.rotation.x = 0;
            this.parts.armL.upper.rotation.x = -2.5;
            this.parts.armR.upper.rotation.x = -2.5;
        }
    }

    animateIdle() {
        const t = this.time;
        this.parts.hips.position.y = 1.0 + Math.sin(t) * 0.02;
        this.mesh.rotation.x = 0;
        
        this.parts.armL.upper.rotation.x = Math.sin(t) * 0.05;
        this.parts.armR.upper.rotation.x = -Math.sin(t) * 0.05;
        this.parts.legL.upper.rotation.x = 0;
        this.parts.legR.upper.rotation.x = 0;
    }
}

import * as THREE from 'three';
import { createLimb, createJoint } from './Utils.js';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        // Visual Rig
        this.mesh = new THREE.Group();
        this.parts = {};
        this.scene.add(this.mesh);
        
        this.initRig();
        
        // Game State
        this.time = 0;
        this.lane = 0;
        this.laneWidth = 3;
        this.targetX = 0;
        
        // Physics
        this.gravity = -40;
        this.jumpForce = 15;
        this.runSpeed = 16;
    }

    initRig() {
        const color = 0xFFD700; // Warning Yellow
        const jointColor = 0x222222;

        // Hips (Root of body parts)
        this.parts.hips = new THREE.Group();
        this.parts.hips.position.y = 1.0;
        this.mesh.add(this.parts.hips);

        // Torso
        // Create upside down so pivot is at hips
        const torso = createLimb(0.12, 0.5, color);
        torso.pivot.rotation.z = Math.PI; 
        torso.pivot.position.y = 0; 
        this.parts.hips.add(torso.pivot);
        this.parts.torso = torso.pivot;

        // Head
        const head = createJoint(0.22, color);
        head.position.set(0, 0.65, 0); // Above hips
        this.parts.hips.add(head);

        // Arms
        this.parts.armL = this.createArm(-1, color, jointColor);
        this.parts.armR = this.createArm(1, color, jointColor);
        
        const shoulderY = 0.5;
        const shoulderX = 0.2;
        this.parts.armL.upper.position.set(-shoulderX, shoulderY, 0);
        this.parts.armR.upper.position.set(shoulderX, shoulderY, 0);
        
        this.parts.hips.add(this.parts.armL.upper);
        this.parts.hips.add(this.parts.armR.upper);

        // Legs
        this.parts.legL = this.createLeg(-1, color, jointColor);
        this.parts.legR = this.createLeg(1, color, jointColor);
        
        const hipX = 0.1;
        this.parts.legL.upper.position.set(-hipX, 0, 0);
        this.parts.legR.upper.position.set(hipX, 0, 0);
        
        this.parts.hips.add(this.parts.legL.upper);
        this.parts.hips.add(this.parts.legR.upper);
    }

    createArm(side, color, jointColor) {
        const uLen = 0.35, lLen = 0.35;
        const upper = createLimb(0.08, uLen, color);
        const lower = createLimb(0.08, lLen, color);
        const joint = createJoint(0.1, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    createLeg(side, color, jointColor) {
        const uLen = 0.45, lLen = 0.45;
        const upper = createLimb(0.1, uLen, color);
        const lower = createLimb(0.1, lLen, color);
        const joint = createJoint(0.12, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            new Audio('jump.mp3').play().catch(()=>{});
        }
    }

    moveLane(dir) {
        this.lane = Math.max(-1, Math.min(1, this.lane + dir));
        this.targetX = this.lane * this.laneWidth;
    }

    update(dt, platforms, isRunning) {
        // Horizontal Lerp
        this.position.x += (this.targetX - this.position.x) * 10 * dt;

        if (isRunning) {
            // Speed up slowly
            this.runSpeed += dt * 0.05;
            this.time += dt * this.runSpeed;
            
            // Move Forward
            this.position.z -= this.runSpeed * dt;

            // Gravity
            this.velocity.y += this.gravity * dt;
            this.position.y += this.velocity.y * dt;

            this.checkCollisions(platforms);
            this.animateRun();
        } else {
            this.time += dt * 2; 
            this.animateIdle();
        }

        this.mesh.position.copy(this.position);
        
        // Death Condition
        return this.position.y > -15;
    }

    checkCollisions(platforms) {
        this.isGrounded = false;
        
        const feetY = this.position.y; 
        const feetZ = this.position.z;
        const feetX = this.position.x;

        // Optimization: only check platforms somewhat close?
        // Rely on array iteration for now (N is small)
        for (const p of platforms) {
            if (feetZ < p.z + p.depth/2 && feetZ > p.z - p.depth/2) {
                if (feetX > p.x - p.width/2 && feetX < p.x + p.width/2) {
                    const surfaceY = p.y + 0.5;
                    // Check landing
                    if (feetY <= surfaceY && feetY > surfaceY - 1.2) {
                        if (this.velocity.y <= 0) {
                            this.velocity.y = 0;
                            this.position.y = surfaceY;
                            this.isGrounded = true;
                            return;
                        }
                    }
                }
            }
        }
    }

    animateRun() {
        const t = this.time;
        
        if (this.isGrounded) {
            this.parts.hips.position.y = 1.0 + Math.abs(Math.sin(t*2)) * 0.05;
            this.mesh.rotation.x = 0.25; // Lean
            
            // Arms
            this.parts.armL.upper.rotation.x = Math.sin(t + Math.PI) * 0.8;
            this.parts.armL.lower.rotation.x = -1.2; 
            this.parts.armR.upper.rotation.x = Math.sin(t) * 0.8;
            this.parts.armR.lower.rotation.x = -1.2;

            // Legs
            this.parts.legL.upper.rotation.x = Math.sin(t) * 1.0;
            this.parts.legL.lower.rotation.x = Math.max(0, Math.sin(t - 1.5) * 2.2);
            
            this.parts.legR.upper.rotation.x = Math.sin(t + Math.PI) * 1.0;
            this.parts.legR.lower.rotation.x = Math.max(0, Math.sin(t + Math.PI - 1.5) * 2.2);
        } else {
            // Jump
            this.parts.legL.upper.rotation.x = 0.8;
            this.parts.legL.lower.rotation.x = 0.5;
            this.parts.legR.upper.rotation.x = -0.5;
            this.parts.legR.lower.rotation.x = 0.5;
            this.mesh.rotation.x = 0;
            this.parts.armL.upper.rotation.x = -2.5;
            this.parts.armR.upper.rotation.x = -2.5;
        }
    }

    animateIdle() {
        const t = this.time;
        this.parts.hips.position.y = 1.0 + Math.sin(t) * 0.02;
        this.mesh.rotation.x = 0;
        
        this.parts.armL.upper.rotation.x = Math.sin(t) * 0.05;
        this.parts.armL.lower.rotation.x = -0.1;
        this.parts.armR.upper.rotation.x = -Math.sin(t) * 0.05;
        this.parts.armR.lower.rotation.x = -0.1;
        
        this.parts.legL.upper.rotation.x = 0;
        this.parts.legR.upper.rotation.x = 0;
    }
}

