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

