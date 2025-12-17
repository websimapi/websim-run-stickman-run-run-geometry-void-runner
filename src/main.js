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
let jumpTriggeredOnPress = false;

function updatePlayerTarget(clientX, clientY) {
    if (inMenu) return;
    
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -character.position.z);
    raycaster.setFromCamera(mouse, camera);
    
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, target);
    
    if (target) {
        character.targetX = target.x;
    }
}

window.addEventListener('pointerdown', (e) => {
    if (inMenu) return;
    if (e.target.tagName === 'BUTTON') return;
    if (e.target.closest('#title-screen')) return; 

    touchStartY = e.clientY;
    jumpTriggeredOnPress = false;

    // Normalize mouse
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // 1. Check tap DIRECTLY on character
    const intersects = raycaster.intersectObject(character.mesh, true);
    
    // 2. Check tap ABOVE character (Screen Space)
    const headPos = character.position.clone();
    headPos.y += 1.6 * character.scale; 
    headPos.project(camera);

    const distX = Math.abs(mouse.x - headPos.x);
    // Check if tap is above head
    const isAboveHead = mouse.y > headPos.y && distX < 0.25;

    if (intersects.length > 0 || isAboveHead) {
        if (!isRunning) startGame();
        else {
            character.jump();
            jumpTriggeredOnPress = true;
        }
        return; 
    }

    if (!isRunning) {
        startGame();
    }
    
    // Immediate move
    updatePlayerTarget(e.clientX, e.clientY);
});

window.addEventListener('pointerup', (e) => {
    if (inMenu) return;
    if (!isRunning || jumpTriggeredOnPress) return;
    
    const dy = e.clientY - touchStartY;
    if (dy < -50) {
        character.jump();
    }
});

window.addEventListener('pointermove', (e) => {
    if (inMenu || !isRunning || isGameOver) return;
    updatePlayerTarget(e.clientX, e.clientY);
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
        if (keys.left) character.targetX -= 30 * dt;
        if (keys.right) character.targetX += 30 * dt;
    }
    
    const alive = character.update(dt, level.platforms, isRunning, inMenu);
    
    if (!inMenu) {
        level.update(character.position.z);
    }

    // Camera
    let targetCamZ, targetCamY, targetCamX;
    
    if (inMenu) {
        // Studio Angle
        targetCamZ = 3.5; 
        targetCamY = 1.6;
        // On mobile (portrait), center the character. On desktop, offset to allow room for UI.
        targetCamX = window.innerWidth < 600 ? 0 : 1.2; 
        
        // Add subtle idle sway to camera
        const t = Date.now() * 0.0005;
        targetCamX += Math.sin(t) * 0.2;
        targetCamY += Math.cos(t * 0.7) * 0.1;
        
        camera.position.x += (targetCamX - camera.position.x) * 2 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 2 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 2 * dt;
        
        camera.lookAt(0, 0.9, 0); 
        
        // Interactive Rotation
        character.mesh.rotation.y = Math.PI + (mouse.x * 0.3);
    } else {
        targetCamZ = character.position.z + 8;
        targetCamY = character.position.y + 4;
        
        camera.position.x += (character.position.x * 0.4 - camera.position.x) * 4 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 5 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 5 * dt;
        
        camera.rotation.z = -character.position.x * 0.02;
        camera.lookAt(0, character.position.y, character.position.z - 8);
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

