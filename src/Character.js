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
        // Face running direction (-Z)
        this.mesh.rotation.y = Math.PI;
        
        // Game State
        this.time = 0;
        this.targetX = 0;
        
        // Physics
        this.gravity = -40;
        this.baseJumpForce = 15;
        this.jumpForce = 15;
        this.baseRunSpeed = 16;
        this.runSpeed = 16;
        this.scale = 1.0;
        
        this.jumpCount = 0;
        this.maxJumps = 2;

        // Ledge Grab State
        this.isClimbing = false;
        this.climbTime = 0;
        this.climbDuration = 0.6;
        this.climbStartPos = new THREE.Vector3();
        this.climbTargetPos = new THREE.Vector3();

        // Menu Animation State
        this.menuTime = 0;
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

    configure(colorHex, size) {
        this.scale = size;
        this.mesh.scale.setScalar(this.scale);

        // Stats Logic
        // Size 0.9 -> Speed +10%, Jump -10%
        // Size 1.1 -> Speed -10%, Jump +10%
        const speedFactor = 1.0 + (1.0 - this.scale);
        const jumpFactor = this.scale;

        this.runSpeed = this.baseRunSpeed * speedFactor;
        this.jumpForce = this.baseJumpForce * jumpFactor;

        // Apply Color
        this.mesh.traverse((child) => {
            if (child.isMesh && child.geometry.type === 'CapsuleGeometry') {
                child.material.color.setHex(colorHex);
            }
        });
    }

    jump() {
        if (this.isClimbing) return;

        if (this.isGrounded || this.jumpCount < this.maxJumps) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.jumpCount++;
            
            const sound = new Audio('jump.mp3');
            if (this.jumpCount > 1) sound.playbackRate = 1.25;
            sound.play().catch(()=>{});
        }
    }

    update(dt, platforms, isRunning, inMenu = false) {
        if (inMenu) {
            this.animateMenu(dt);
            this.mesh.position.copy(this.position);
            return true;
        }

        if (this.isClimbing) {
            this.updateClimb(dt);
            return true;
        }

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

            const landed = this.checkCollisions(platforms);
            
            if (!landed && this.velocity.y < 0) {
                this.checkLedgeGrab(platforms);
            }

            this.animateRun();
        } else {
            this.time += dt * 2; 
            this.animateIdle();
        }

        this.mesh.position.copy(this.position);
        
        // Death Condition
        return this.position.y > -15;
    }

    animateMenu(dt) {
        this.menuTime += dt;
        const cycleDuration = 8.0;
        const t = this.menuTime % cycleDuration;
        
        // Cycle: 
        // 0-1.5s: Idle
        // 1.5-2.0s: Small Jump/Bounce
        // 2.0-4.0s: Idle
        // 4.0-7.0s: Run in Place
        // 7.0-8.0s: Transition to Idle

        if (t < 1.5) {
            // Idle
            this.time += dt * 2;
            this.animateIdle();
            this.position.y = 0;
        } else if (t < 2.0) {
            // Bounce
            const bounceT = (t - 1.5) / 0.5; // 0 to 1
            this.position.y = Math.sin(bounceT * Math.PI) * 0.5;
            
            // Arms up a bit
            this.parts.armL.upper.rotation.x = -2.0;
            this.parts.armR.upper.rotation.x = -2.0;
            this.parts.legL.upper.rotation.x = 0.5;
            this.parts.legR.upper.rotation.x = -0.5;
        } else if (t < 4.0) {
            // Idle
            this.time += dt * 2;
            this.animateIdle();
            this.position.y = 0;
        } else if (t < 7.0) {
            // Run in Place
            this.time += dt * 15; // Fast run anim
            this.animateRun();
            this.position.y = 0;
            
            // Correct run anim for "in place" (remove lean if needed, but lean looks cool)
            this.mesh.rotation.x = 0.1; 
        } else {
            // Transition back to idle
            this.time += dt * 2;
            this.animateIdle();
            this.position.y = 0;
        }
    }

    checkCollisions(platforms) {
        this.isGrounded = false;
        
        const feetY = this.position.y; 
        const feetZ = this.position.z;
        const feetX = this.position.x;
        const height = 1.6 * this.scale;
        const headY = feetY + height;

        for (const p of platforms) {
            // Horizontal bounds check
            if (feetZ < p.z + p.depth/2 && feetZ > p.z - p.depth/2) {
                if (feetX > p.x - p.width/2 && feetX < p.x + p.width/2) {
                    
                    const surfaceY = p.y + 0.5;
                    const bottomY = p.y - 0.5;

                    // 1. Ceiling Collision
                    if (this.velocity.y > 0) {
                        if (headY >= bottomY && headY < p.y) {
                            this.velocity.y = 0;
                            this.position.y = bottomY - height - 0.05; // Bounce off
                            return false;
                        }
                    }

                    // 2. Floor Collision
                    if (feetY <= surfaceY && feetY > surfaceY - (1.2 * this.scale)) {
                        if (this.velocity.y <= 0) {
                            this.velocity.y = 0;
                            this.position.y = surfaceY;
                            this.isGrounded = true;
                            this.jumpCount = 0;
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    checkLedgeGrab(platforms) {
        if (this.velocity.y > 0) return; // Only grab when falling

        const feetY = this.position.y;
        const feetZ = this.position.z;
        const feetX = this.position.x;
        
        for (const p of platforms) {
            const surfaceY = p.y + 0.5;
            const drop = surfaceY - feetY;

            // Height check common for all grabs
            if (drop < 1.0 * this.scale || drop > 2.5 * this.scale) continue;

            // 1. Front Ledge Check
            const pEdgeZ = p.z + p.depth / 2;
            const distZ = feetZ - pEdgeZ;
            
            // Must be aligned horizontally for front grab
            if (feetX > p.x - p.width/2 && feetX < p.x + p.width/2) {
                if (distZ > -0.2 && distZ < 0.8) {
                    // Target: move onto platform in Z, keep X
                    const target = new THREE.Vector3(this.position.x, surfaceY, pEdgeZ - 0.5);
                    const snap = new THREE.Vector3(this.position.x, this.position.y, pEdgeZ + 0.25);
                    this.startClimb(target, snap, Math.PI); // Face Front
                    return;
                }
            }

            // 2. Side Ledge Check
            // Must be within Z bounds of the platform
            if (feetZ < p.z + p.depth/2 && feetZ > p.z - p.depth/2) {
                const leftEdge = p.x - p.width/2;
                const rightEdge = p.x + p.width/2;
                const grabDist = 0.6; 

                // Left Side (Platform is to the right of player)
                // Player X < LeftEdge => Needs to face +X (Right) to grab
                if (feetX < leftEdge && feetX > leftEdge - grabDist) {
                    // Target: move onto platform (leftEdge + padding)
                    const target = new THREE.Vector3(leftEdge + 0.4, surfaceY, feetZ - 0.5);
                    const snap = new THREE.Vector3(leftEdge - 0.2, this.position.y, feetZ);
                    this.startClimb(target, snap, Math.PI / 2); 
                    return;
                }

                // Right Side (Platform is to the left of player)
                // Player X > RightEdge => Needs to face -X (Left) to grab
                if (feetX > rightEdge && feetX < rightEdge + grabDist) {
                    const target = new THREE.Vector3(rightEdge - 0.4, surfaceY, feetZ - 0.5);
                    const snap = new THREE.Vector3(rightEdge + 0.2, this.position.y, feetZ);
                    this.startClimb(target, snap, Math.PI * 1.5); // 270 deg is Left
                    return;
                }
            }
        }
    }

    startClimb(targetPos, snapPos, facingAngle) {
        this.isClimbing = true;
        this.climbTime = 0;
        this.velocity.set(0, 0, 0);
        
        this.climbStartPos.copy(this.position);
        
        if (snapPos) {
            this.climbStartPos.x = snapPos.x;
            this.climbStartPos.z = snapPos.z;
        }
        
        this.climbTargetPos.copy(targetPos);
        this.mesh.rotation.x = 0; // Reset lean
        
        this.climbStartRot = this.mesh.rotation.y;
        this.climbTargetRot = (facingAngle !== undefined) ? facingAngle : Math.PI;
    }

    updateClimb(dt) {
        this.climbTime += dt;
        const t = Math.min(this.climbTime / this.climbDuration, 1.0);
        
        // Easing
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
        
        this.position.lerpVectors(this.climbStartPos, this.climbTargetPos, ease);
        this.mesh.position.copy(this.position);
        
        // Rotation Lerp (Quick turn)
        const rotT = Math.min(this.climbTime / 0.15, 1.0); 
        this.mesh.rotation.y = this.climbStartRot + (this.climbTargetRot - this.climbStartRot) * rotT;
        
        this.animateClimb(t);

        if (t >= 1.0) {
            this.isClimbing = false;
            this.isGrounded = true;
            this.jumpCount = 0;
            this.position.copy(this.climbTargetPos);
            // Sync targetX so we don't drift back immediately
            this.targetX = this.position.x;
            this.mesh.rotation.y = Math.PI; // Reset to face forward
        }
    }

    animateClimb(t) {
        const hips = this.parts.hips;
        const armL = this.parts.armL;
        const armR = this.parts.armR;
        const legL = this.parts.legL;
        const legR = this.parts.legR;

        // Reset lean
        this.mesh.rotation.x = 0;

        if (t < 0.3) {
            // Grab Phase
            hips.position.y = 1.0;
            // Arms Reach Up
            armL.upper.rotation.x = -2.8; 
            armR.upper.rotation.x = -2.8;
            armL.lower.rotation.x = -0.5;
            armR.lower.rotation.x = -0.5;
            // Legs Dangle
            legL.upper.rotation.x = 0.2;
            legR.upper.rotation.x = 0.2;
        } else {
            // Pull Up Phase
            const pull = (t - 0.3) / 0.7;
            hips.position.y = 1.0 + pull * 0.2;
            
            // Arms pull down
            armL.upper.rotation.x = -2.8 + pull * 2.5; 
            armR.upper.rotation.x = -2.8 + pull * 2.5;
            
            // Legs knee up
            legL.upper.rotation.x = 0.2 + Math.sin(pull * Math.PI) * 1.5;
            legR.upper.rotation.x = 0.2 + Math.sin(pull * Math.PI) * 1.5;
            legL.lower.rotation.x = 0;
            legR.lower.rotation.x = 0;
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

