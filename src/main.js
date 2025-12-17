import * as THREE from 'three';
import { Character } from './Character.js';
import { Level } from './Level.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.03); // The Void

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
scene.add(dirLight);

// Objects
const character = new Character(scene);
const level = new Level(scene);

// Menu Environment
const menuStageGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.1, 32);
const menuStageMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.8,
});
const menuStage = new THREE.Mesh(menuStageGeo, menuStageMat);
menuStage.position.y = -0.05;
menuStage.receiveShadow = true;
scene.add(menuStage);

// Emissive ring for stage
const ringGeo = new THREE.TorusGeometry(2.4, 0.05, 16, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
const menuRing = new THREE.Mesh(ringGeo, ringMat);
menuRing.rotation.x = -Math.PI / 2;
menuRing.position.y = 0.01;
menuStage.add(menuRing);

// Menu Spotlight
const menuLight = new THREE.SpotLight(0xffffff, 8);
menuLight.position.set(0, 6, 3);
menuLight.angle = 0.6;
menuLight.penumbra = 0.3;
menuLight.castShadow = true;
menuLight.shadow.bias = -0.0001;
scene.add(menuLight);

// UI
const uiScore = document.getElementById('ui');
const uiGameOver = document.getElementById('game-over');
const uiFinalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const hintEl = document.getElementById('controls-hint');
const titleScreen = document.getElementById('title-screen');
const startGameBtn = document.getElementById('start-game-btn');

// Character Creation UI
const swatches = document.querySelectorAll('.swatch');
const sizeSlider = document.getElementById('size-slider');
const speedStat = document.getElementById('speed-stat');
const jumpStat = document.getElementById('jump-stat');

let selectedColor = 0xFFD700;
let selectedSize = 1.0;

swatches.forEach(s => {
    s.addEventListener('click', () => {
        swatches.forEach(sw => sw.classList.remove('selected'));
        s.classList.add('selected');
        selectedColor = parseInt(s.dataset.color);
        character.configure(selectedColor, selectedSize);
    });
});

sizeSlider.addEventListener('input', (e) => {
    selectedSize = parseFloat(e.target.value);
    
    // Update labels
    const speedP = Math.round((1.0 + (1.0 - selectedSize)) * 100);
    const jumpP = Math.round(selectedSize * 100);
    
    speedStat.innerText = `SPEED: ${speedP}%`;
    jumpStat.innerText = `JUMP: ${jumpP}%`;
    
    character.configure(selectedColor, selectedSize);
});

// State
let isRunning = false;
let isGameOver = false;
let inMenu = true;
const clock = new THREE.Clock();
const bgm = new Audio('bgm_space.mp3');
bgm.loop = true;
bgm.volume = 0.5;

startGameBtn.addEventListener('click', () => {
    inMenu = false;
    titleScreen.style.display = 'none';
    uiScore.style.display = 'block';
    hintEl.style.display = 'block';
    
    // Hide menu environment
    menuStage.visible = false;
    menuLight.visible = false;
    
    // Show game level
    level.start();
    
    // Apply final config
    character.configure(selectedColor, selectedSize);
});

function startGame() {
    if (isRunning || inMenu) return;
    isRunning = true;
    hintEl.style.opacity = 0;
    bgm.play().catch(()=>{});
}

// Input State
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const keys = { left: false, right: false };
let touchStartY = 0;
let lastTouchX = 0;
let jumpTriggeredOnPress = false;

// We no longer use raycasting for X position, but rather relative movement
function updatePlayerTarget(clientX, clientY) {
    if (inMenu) return;
    
    // On desktop, map mouse X [-1, 1] to Angle [-PI, PI]?
    // Or continuous steering?
    // Let's do continuous steering for touch, map for mouse?
    // User wants "360 movement". 
    // Mouse: Map center of screen to player angle.
    // Normalized Mouse X (-1 to 1) -> Target Angle Offset?
    
    // Better: Delta movement.
    // But for a runner, absolute control is often easier.
    // Let's map Screen Width to ONE full rotation (2PI).
    
    // Normalized 0..1
    const nX = clientX / window.innerWidth;
    // Map to -PI to PI
    const targetA = (nX - 0.5) * Math.PI * 2;
    // But this snaps absolute position.
    
    // Let's just use the previous logic: move target based on input
    // If we want 360, maybe we just increment/decrement targetAngle?
    // For mouse/touch drag:
    // We handle this in the event listeners
}

window.addEventListener('pointerdown', (e) => {
    if (inMenu) return;
    if (e.target.tagName === 'BUTTON') return;
    if (e.target.closest('#title-screen')) return; 

    touchStartY = e.clientY;
    lastTouchX = e.clientX;
    jumpTriggeredOnPress = false;

    // Normalize mouse for interactions
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    if (!isRunning) {
        startGame();
    }
});

window.addEventListener('pointerup', (e) => {
    if (inMenu) return;
    if (!isRunning || jumpTriggeredOnPress) return;
    
    const dy = e.clientY - touchStartY;
    if (dy < -50) { // Swipe up
        character.jump();
        jumpTriggeredOnPress = true; // Prevent double trigger
    } else if (Math.abs(dy) < 10 && Math.abs(e.clientX - lastTouchX) < 10) {
        // Tap
        character.jump();
    }
});

window.addEventListener('pointermove', (e) => {
    if (inMenu || !isRunning || isGameOver) return;
    
    // Drag to steer
    // Sensitivity: Full screen width = 2 rotations?
    const dx = e.clientX - lastTouchX;
    lastTouchX = e.clientX;
    
    // Sensitivity
    const sens = 0.01;
    character.targetAngle += dx * sens;
});

window.addEventListener('keydown', (e) => {
    if (isGameOver || inMenu) return;
    if (!isRunning) {
        if(['Space','ArrowUp','KeyW','ArrowLeft','ArrowRight'].includes(e.code)) startGame();
    }
    
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') character.jump();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

restartBtn.addEventListener('click', () => {
    isGameOver = false;
    isRunning = false;
    character.position.set(0, 0, 0);
    character.velocity.set(0, 0, 0);
    character.targetX = 0;
    
    // Reset speed based on config
    character.configure(selectedColor, selectedSize);
    
    character.isGrounded = false;
    character.jumpCount = 0;
    
    // Ensure proper level reset
    level.reset();
    level.start(); // Make sure start platform is visible for retry
    
    uiGameOver.classList.remove('visible');
    uiScore.innerText = "SCORE: 0";
    hintEl.style.opacity = 1;
});

// Game Loop
function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1);

    if (isRunning && !isGameOver) {
        const turnSpeed = 3.0;
        if (keys.left) character.targetAngle -= turnSpeed * dt;
        if (keys.right) character.targetAngle += turnSpeed * dt;
    }
    
    const alive = character.update(dt, level.platforms, isRunning, inMenu);
    
    if (!inMenu) {
        level.update(character.position.z);
    }

    // Camera
    if (inMenu) {
        // Studio Angle (unchanged)
        let targetCamZ = 3.5; 
        let targetCamY = 1.6;
        let targetCamX = window.innerWidth < 600 ? 0 : 1.2; 
        
        const t = Date.now() * 0.0005;
        targetCamX += Math.sin(t) * 0.2;
        targetCamY += Math.cos(t * 0.7) * 0.1;
        
        camera.position.x += (targetCamX - camera.position.x) * 2 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 2 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 2 * dt;
        camera.rotation.set(0,0,0);
        camera.lookAt(0, 0.9, 0); 
        
        // Interactive Rotation
        character.mesh.rotation.y = Math.PI + (mouse.x * 0.3);
    } else {
        // Cylinder Follow Camera
        // We want the camera to rotate WITH the player around the center Z axis
        // And stay "above" the player (towards center).
        // Actually, for "Run" style, camera is usually fixed "up" relative to player surface
        
        const r = 8; // Tunnel radius
        const camHeight = 4.0; // Distance from wall inwards
        const camDist = 6.0; // Distance behind player
        
        // We want camera at angle = char.angle
        // Radius from center = r - camHeight
        const camR = r - camHeight;
        
        // Target Camera Position (Polar -> Cartesian)
        // Lerp angle for smoothness
        const charAngle = character.angle;
        
        const targetX = camR * Math.sin(charAngle);
        const targetY = -camR * Math.cos(charAngle);
        const targetZ = character.position.z + camDist;

        // Smooth follow
        camera.position.x += (targetX - camera.position.x) * 5 * dt;
        camera.position.y += (targetY - camera.position.y) * 5 * dt;
        camera.position.z += (targetZ - camera.position.z) * 5 * dt;
        
        // Rotation:
        // Camera Up vector should be towards center? 
        // Or simply rotate camera Z to match player angle?
        // camera.rotation.z = -charAngle;
        
        // Look at player? Or look ahead?
        // Look ahead point
        const lookZ = character.position.z - 10;
        const lookX = (r - 2) * Math.sin(charAngle);
        const lookY = -(r - 2) * Math.cos(charAngle);
        
        camera.lookAt(lookX, lookY, lookZ);
        
        // Roll camera to match player local up
        camera.rotation.z = -charAngle; 
    }
    
    // Light
    dirLight.position.z = character.position.z + 10;
    dirLight.target.position.z = character.position.z;
    dirLight.target.updateMatrixWorld();

    // Score
    uiScore.innerText = "SCORE: " + Math.floor(Math.abs(character.position.z));

    if (!alive && !isGameOver) {
        isGameOver = true;
        uiGameOver.classList.add('visible');
        uiFinalScore.innerText = "SCORE: " + Math.floor(Math.abs(character.position.z));
    }
    
    renderer.render(scene, camera);
}

animate();

