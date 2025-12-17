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

// UI
const uiScore = document.getElementById('ui');
const uiGameOver = document.getElementById('game-over');
const uiFinalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const hintEl = document.getElementById('controls-hint');

// State
let isRunning = false;
let isGameOver = false;
const clock = new THREE.Clock();
const bgm = new Audio('bgm_space.mp3');
bgm.loop = true;
bgm.volume = 0.5;

function startGame() {
    if (isRunning) return;
    isRunning = true;
    hintEl.style.opacity = 0;
    bgm.play().catch(()=>{});
}

// Input State
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const keys = { left: false, right: false };

function updatePlayerTarget(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    // Create a plane at the character's Z depth to map mouse X to world X accurately
    // Plane normal (0,0,1), constant is distance from origin (which is -character.position.z)
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -character.position.z);
    raycaster.setFromCamera(mouse, camera);
    
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, target);
    
    if (target) {
        character.targetX = target.x;
    }
}

window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;

    // Check tap on character
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // Check character intersection for jump
    const intersects = raycaster.intersectObject(character.mesh, true);
    if (intersects.length > 0) {
        if (!isRunning) startGame();
        else character.jump();
        return;
    }

    if (!isRunning) {
        startGame();
    }
    
    // Immediate move
    updatePlayerTarget(e.clientX, e.clientY);
});

window.addEventListener('pointermove', (e) => {
    if (!isRunning || isGameOver) return;
    updatePlayerTarget(e.clientX, e.clientY);
});

window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
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
    character.runSpeed = 16;
    character.isGrounded = false;
    character.jumpCount = 0;
    level.reset();
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
    
    const alive = character.update(dt, level.platforms, isRunning);
    level.update(character.position.z);

    // Camera
    const camZ = character.position.z + 8;
    const camY = character.position.y + 4;
    
    camera.position.z = camZ;
    camera.position.y += (camY - camera.position.y) * 5 * dt;
    camera.position.x += (character.position.x * 0.4 - camera.position.x) * 4 * dt;
    camera.rotation.z = -character.position.x * 0.02; // Slight tilt
    camera.lookAt(0, character.position.y, character.position.z - 8);
    
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

