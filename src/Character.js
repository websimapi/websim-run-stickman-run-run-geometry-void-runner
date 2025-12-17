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
        this.angle = 0;
        this.targetAngle = 0;
        this.radius = 8; // Match level radius
        this.height = 0; // Height from surface
        
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
            // In menu, override rotation for studio look
            this.mesh.rotation.set(0, Math.PI, 0); 
            return true;
        }

        if (this.isClimbing) {
            this.updateClimb(dt);
            return true;
        }

        // Angular Lerp (Shortest path)
        let diff = this.targetAngle - this.angle;
        // Normalize diff to -PI to PI
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        this.angle += diff * 10 * dt;
        // Normalize angle
        this.angle = this.angle % (Math.PI * 2);

        if (isRunning) {
            // Speed up slowly
            this.runSpeed += dt * 0.05;
            this.time += dt * this.runSpeed;
            
            // Move Forward
            this.position.z -= this.runSpeed * dt;

            // Vertical Physics (Radial)
            this.velocity.y += this.gravity * dt; // velocity.y acts as radial velocity here
            this.height += this.velocity.y * dt;

            const landed = this.checkCollisions(platforms);
            
            if (!landed && this.velocity.y < 0) {
                this.checkLedgeGrab(platforms);
            }

            this.animateRun();
        } else {
            this.time += dt * 2; 
            this.animateIdle();
        }

        // Convert Polar to Cartesian
        const effectiveR = this.radius - this.height;
        this.position.x = effectiveR * Math.sin(this.angle);
        this.position.y = -effectiveR * Math.cos(this.angle);

        this.mesh.position.copy(this.position);
        
        // Rotation: Align feet to center, Face -Z
        // Standard rotation: Z axis rotation = -angle
        this.mesh.rotation.set(0, 0, -this.angle);
        this.mesh.rotateY(Math.PI); // Face forward

        // Death Condition (Fall inward too far or glitch out)
        // In cylinder runner, you don't really fall "off", but maybe if you hit a void section?
        // Let's say if height is too negative (glitched through floor)
        return this.height > -5; 
    }

    animateMenu(dt) {
        this.menuTime += dt;
        
        // Smooth cycle: Idle -> Warmup -> Run -> CoolDown
        const cycle = 8;
        const t = this.menuTime % cycle;
        
        // Calculate transition factor (0 = idle, 1 = run)
        // using a smoothstep curve for fluid blending
        let runFactor = 0;
        if (t > 2.5 && t < 6.5) {
            if (t < 3.5) runFactor = (t - 2.5); // 0 to 1 over 1s
            else if (t > 5.5) runFactor = (6.5 - t); // 1 to 0 over 1s
            else runFactor = 1;
        }
        // Apply easing to make it less linear
        runFactor = runFactor * runFactor * (3 - 2 * runFactor);

        // Update internal animation time based on activity level
        // Idle is slow (2x), Run is fast (based on runSpeed)
        const speed = 2 * (1 - runFactor) + (this.runSpeed * 0.8) * runFactor;
        this.time += dt * speed;
        
        const time = this.time;
        
        // --- Calculate & Blend Rotations ---
        
        // Hips Y (Bobbing height)
        const idleHipsY = 1.0 + Math.sin(time * 0.5) * 0.03;
        const runHipsY = 1.0 + Math.abs(Math.sin(time)) * 0.1;
        this.parts.hips.position.y = THREE.MathUtils.lerp(idleHipsY, runHipsY, runFactor);

        // Body Lean
        this.mesh.rotation.x = THREE.MathUtils.lerp(0, 0.2, runFactor);

        // Arms
        // Idle Arm Swing
        const iArmL = Math.sin(time * 0.5) * 0.05;
        const iArmR = -Math.sin(time * 0.5) * 0.05;
        // Run Arm Swing
        const rArmL = Math.sin(time + Math.PI) * 1.0;
        const rArmR = Math.sin(time) * 1.0;
        
        this.parts.armL.upper.rotation.x = THREE.MathUtils.lerp(iArmL, rArmL, runFactor);
        this.parts.armR.upper.rotation.x = THREE.MathUtils.lerp(iArmR, rArmR, runFactor);
        
        // Forearms
        this.parts.armL.lower.rotation.x = THREE.MathUtils.lerp(-0.1, -1.5, runFactor);
        this.parts.armR.lower.rotation.x = THREE.MathUtils.lerp(-0.1, -1.5, runFactor);

        // Legs
        // Idle Legs (Stand still)
        const iLeg = 0;
        // Run Legs
        const rLegL = Math.sin(time) * 1.2;
        const rLegR = Math.sin(time + Math.PI) * 1.2;
        
        this.parts.legL.upper.rotation.x = THREE.MathUtils.lerp(iLeg, rLegL, runFactor);
        this.parts.legR.upper.rotation.x = THREE.MathUtils.lerp(iLeg, rLegR, runFactor);
        
        // Knees
        const rKneeL = Math.max(0, Math.sin(time - 1.5) * 2.2);
        const rKneeR = Math.max(0, Math.sin(time + Math.PI - 1.5) * 2.2);
        
        this.parts.legL.lower.rotation.x = THREE.MathUtils.lerp(0, rKneeL, runFactor);
        this.parts.legR.lower.rotation.x = THREE.MathUtils.lerp(0, rKneeR, runFactor);

        // Ensure grounded Y
        this.position.y = 0;
    }

    checkCollisions(platforms) {
        this.isGrounded = false;
        
        const myZ = this.position.z;
        const myHeight = this.height; 
        const myAngle = this.angle; // -PI to PI approx

        // Normalize angle to 0..2PI for easier comparison? Or keep -PI..PI
        // Let's rely on angular difference
        
        for (const p of platforms) {
            // Z Overlap
            if (myZ < p.z + p.depth/2 && myZ > p.z - p.depth/2) {
                
                // Angle Overlap
                let diff = Math.abs(p.angle - myAngle);
                while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
                
                // Convert platform width factor to angle width approximation
                // widthScale 1.5 ~= 3 units. Circumference 50. 
                // Angle width ~= (widthScale * 2) / 8
                const halfAngleWidth = (p.width * 1.0) / this.radius; 
                
                if (diff < halfAngleWidth) {
                    
                    const surfaceHeight = p.y + 0.5;
                    const bottomHeight = p.y - 0.5;

                    // 1. Ceiling
                    // If height is increasing (moving in toward center)
                    // But gravity makes velocity negative... 
                    // Actually, "up" is towards center. velocity > 0 is jump.
                    // Platform "y" is offset from wall.
                    // Wall is height 0.
                    
                    if (this.velocity.y > 0) {
                        // Hitting bottom of platform from below (closer to wall)
                        if (myHeight >= bottomHeight - 0.2 && myHeight < p.y) {
                            this.velocity.y = 0;
                            this.height = bottomHeight - 0.2;
                            return false;
                        }
                    }

                    // 2. Floor
                    // Falling towards wall (velocity < 0)
                    if (myHeight <= surfaceHeight && myHeight > surfaceHeight - 0.5) {
                        if (this.velocity.y <= 0) {
                            this.velocity.y = 0;
                            this.height = surfaceHeight;
                            this.isGrounded = true;
                            this.jumpCount = 0;
                            return true;
                        }
                    }
                }
            }
        }
        
        // Base Floor (The Tunnel Wall)
        if (this.height <= 0) {
             if (this.velocity.y <= 0) {
                this.velocity.y = 0;
                this.height = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
                return true;
            }
        }
        
        return false;
    }

    checkLedgeGrab(platforms) {
        if (this.velocity.y > 0) return; 

        // Simplified Ledge Grab for Cylinder: Front Only
        const myZ = this.position.z;
        const myHeight = this.height;
        const myAngle = this.angle;
        
        for (const p of platforms) {
            const surfaceHeight = p.y + 0.5;
            const drop = surfaceHeight - myHeight;

            if (drop < 0.2 || drop > 2.0 * this.scale) continue;

            const pEdgeZ = p.z + p.depth / 2;
            const distZ = myZ - pEdgeZ;
            
            // Check Angle Alignment
            let diff = Math.abs(p.angle - myAngle);
            while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
            const halfAngleWidth = (p.width * 0.8) / this.radius; 

            if (diff < halfAngleWidth) {
                if (distZ > -0.2 && distZ < 0.8) {
                    // Calc target positions in Cartesian for the animation lerp
                    const targetR = this.radius - surfaceHeight;
                    const snapR = this.radius - myHeight;
                    
                    const targetX = targetR * Math.sin(myAngle);
                    const targetY = -targetR * Math.cos(myAngle);
                    
                    const snapX = snapR * Math.sin(myAngle);
                    const snapY = -snapR * Math.cos(myAngle);
                    
                    const target = new THREE.Vector3(targetX, targetY, pEdgeZ - 0.5);
                    const snap = new THREE.Vector3(snapX, snapY, pEdgeZ + 0.25);
                    
                    // Facing: we want to keep facing -Z (Math.PI) relative to character frame
                    // But startClimb expects rotation around Y.
                    // For the cylinder, we might need to adjust this.
                    // Actually, the character mesh rotates -angle on Z, then Y.
                    // Let's pass a flag or just use PI (Standard forward).
                    this.startClimb(target, snap, Math.PI); 
                    
                    // Fix height/angle state for after climb
                    this.targetHeightAfterClimb = surfaceHeight;
                    return;
                }
            }
        }
    }

    startClimb(targetPos, snapPos, facingAngle) {
        this.isClimbing = true;
        this.climbTime = 0;
        this.velocity.set(0, 0, 0);
        
        // Convert SnapPos to current Cartesian
        this.climbStartPos.copy(this.position);
        if (snapPos) {
             // For cylinder, we just snap Z, keep curve position
             // Actually snapPos passed in is Cartesian
             this.climbStartPos.copy(snapPos);
        }
        
        this.climbTargetPos.copy(targetPos);
        
        // In cylinder mode, we just animate the Mesh local Y rotation
        // But the whole mesh is rotated by Z.
        // We'll reset local Y to PI (Forward)
        this.mesh.rotation.y = Math.PI; 
    }

    updateClimb(dt) {
        this.climbTime += dt;
        const t = Math.min(this.climbTime / this.climbDuration, 1.0);
        
        // Easing
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
        
        this.position.lerpVectors(this.climbStartPos, this.climbTargetPos, ease);
        this.mesh.position.copy(this.position);
        
        // Keep the Z-rotation alignment during climb
        // We can approximate by keeping current angle or interpolating angle if we had target angle
        // For simplicity, just update the mesh Z rotation based on current pos
        const angle = Math.atan2(this.position.x, -this.position.y); // Approx angle from pos
        this.mesh.rotation.set(0, 0, -angle);
        this.mesh.rotateY(Math.PI);
        
        this.animateClimb(t);

        if (t >= 1.0) {
            this.isClimbing = false;
            this.isGrounded = true;
            this.jumpCount = 0;
            this.position.copy(this.climbTargetPos);
            
            // Sync state vars
            if (this.targetHeightAfterClimb !== undefined) {
                this.height = this.targetHeightAfterClimb;
                this.targetHeightAfterClimb = undefined;
            }
            // Angle should be correct from Z position update? No, angle needs to match position
            this.angle = Math.atan2(this.position.x, -this.position.y);
            this.targetAngle = this.angle;
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

