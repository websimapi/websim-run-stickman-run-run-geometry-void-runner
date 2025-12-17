import * as THREE from 'three';
import { Character } from './Character.js';
import { Level } from './Level.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scoreEl = document.getElementById('score');
        this.finalScoreEl = document.getElementById('final-score');
        this.gameOverEl = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');
        this.instructions = document.getElementById('instructions');

        this.scene = new THREE.Scene();
        // Fog for the void effect
        this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 4, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        this.scene.add(dirLight);
        this.dirLight = dirLight;

        // Game Objects
        this.character = new Character(this.scene);
        this.level = new Level(this.scene);

        // Audio
        this.bgm = new Audio('bgm_space.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.4;
        this.bgmStarted = false;

        // State
        this.isRunning = false; // Waiting for first tap
        this.isGameOver = false;
        this.score = 0;

        // Inputs
        this.setupInputs();

        // Loop
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.restartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.reset();
        });
    }

    setupInputs() {
        // Mobile & Desktop Unified Input
        // Screen divided into 3 zones technically, but lets do logic:
        // Tap center -> Jump
        // Tap left -> Left
        // Tap right -> Right
        // Or Swipe?
        // User requested "tap to move". 
        // Let's divide screen width into 3rds.
        
        const handleInput = (x) => {
            if (this.isGameOver) return;
            
            if (!this.isRunning) {
                this.isRunning = true;
                this.instructions.style.opacity = 0;
                if (!this.bgmStarted) {
                    this.bgm.play().catch(e => console.log("Audio autoplay prevented"));
                    this.bgmStarted = true;
                }
                return;
            }

            const width = window.innerWidth;
            if (x < width * 0.3) {
                // Left
                this.character.moveLane(-1);
            } else if (x > width * 0.7) {
                // Right
                this.character.moveLane(1);
            } else {
                // Center - Jump
                this.character.jump();
            }
        };

        window.addEventListener('pointerdown', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            handleInput(e.clientX);
        });

        window.addEventListener('keydown', (e) => {
            if (this.isGameOver) return;
            if (!this.isRunning && (e.code === 'Space' || e.code === 'ArrowUp')) {
                handleInput(window.innerWidth/2); // start game
                return;
            }
            
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                this.character.moveLane(-1);
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.character.moveLane(1);
            } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                this.character.jump();
            }
        });
    }

    reset() {
        this.isGameOver = false;
        this.isRunning = false;
        this.score = 0;
        this.character.position.set(0, 5, 0);
        this.character.velocity.set(0, 0, 0);
        this.character.lane = 0;
        this.character.targetX = 0;
        this.character.isGrounded = false;
        
        this.level.reset();
        
        this.gameOverEl.classList.remove('visible');
        this.instructions.style.opacity = 1;
        this.scoreEl.innerText = "0m";
    }

    animate() {
        requestAnimationFrame(this.animate);

        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.isRunning && !this.isGameOver) {
            // Update Level
            this.level.update(this.character.position.z);
            
            // Update Character
            const alive = this.character.update(dt, this.level.platforms);

            // Camera follow
            // Camera stays at constant offset relative to player, but smoothed
            const targetCamZ = this.character.position.z + 8;
            const targetCamY = this.character.position.y + 4;
            // Keep X centered or slightly follow?
            // "Run" game camera usually rotates or stays fixed relative to tunnel. 
            // Fixed X is good to see lanes.
            
            this.camera.position.z = targetCamZ;
            this.camera.position.y += (targetCamY - this.camera.position.y) * 5 * dt;
            // Look slightly ahead of player
            this.camera.lookAt(0, this.character.position.y, this.character.position.z - 5);
            
            // Light follows player
            this.dirLight.position.z = this.character.position.z + 10;
            this.dirLight.target.position.z = this.character.position.z;
            this.dirLight.target.updateMatrixWorld();

            // Score
            this.score = Math.floor(Math.abs(this.character.position.z));
            this.scoreEl.innerText = this.score + "m";

            if (!alive) {
                this.gameOver();
            }
        } else if (!this.isRunning && !this.isGameOver) {
             // Idle animation logic if wanted
             // Render loop continues
        }

        this.renderer.render(this.scene, this.camera);
    }

    gameOver() {
        this.isGameOver = true;
        this.finalScoreEl.innerText = `Distance: ${this.score}m`;
        this.gameOverEl.classList.add('visible');
    }
}

new Game();

import * as THREE from 'three';
import { Character } from './Character.js';
import { Level } from './Level.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.035);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// Game Objects
const character = new Character(scene);
const level = new Level(scene);
const uiScore = document.getElementById('ui');
const uiGameOver = document.getElementById('game-over');
const uiFinalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

let isRunning = false;
let isGameOver = false;
const clock = new THREE.Clock();
const bgm = new Audio('bgm_space.mp3');
bgm.loop = true;
bgm.volume = 0.5;

function startGame() {
    if (isRunning) return;
    isRunning = true;
    bgm.play().catch(()=>{});
}

function handleInput(x) {
    if (isGameOver) return;
    if (!isRunning) {
        startGame();
        return;
    }

    const w = window.innerWidth;
    if (x < w * 0.3) {
        character.moveLane(-1);
    } else if (x > w * 0.7) {
        character.moveLane(1);
    } else {
        character.jump();
    }
}

// Events
window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'BUTTON') handleInput(e.clientX);
});

window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    if (!isRunning) {
        if(['Space','ArrowUp','KeyW','ArrowLeft','ArrowRight'].includes(e.code)) startGame();
        return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') character.moveLane(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') character.moveLane(1);
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') character.jump();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

restartBtn.addEventListener('click', () => {
    isGameOver = false;
    isRunning = false; // Go back to idle start
    character.position.set(0, 0, 0);
    character.velocity.set(0, 0, 0);
    character.lane = 0;
    character.targetX = 0;
    character.isGrounded = false;
    level.reset();
    uiGameOver.classList.remove('visible');
    uiScore.innerText = "0";
});

// Loop
function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1);
    
    const alive = character.update(dt, level.platforms, isRunning);
    level.update(character.position.z);

    // Camera follow
    const camZOffset = 8;
    const camYOffset = 5;
    camera.position.z = character.position.z + camZOffset;
    camera.position.y += (character.position.y + camYOffset - camera.position.y) * 5 * dt;
    camera.position.x += (character.position.x * 0.3 - camera.position.x) * 3 * dt; // Slight lerp to x
    camera.lookAt(0, character.position.y, character.position.z - 10);
    
    // Light follow
    dirLight.position.z = character.position.z + 10;
    dirLight.target.position.z = character.position.z;
    dirLight.target.updateMatrixWorld();

    uiScore.innerText = Math.floor(Math.abs(character.position.z));

    if (!alive && !isGameOver) {
        isGameOver = true;
        uiGameOver.classList.add('visible');
        uiFinalScore.innerText = "SCORE: " + Math.floor(Math.abs(character.position.z));
    }
    
    renderer.render(scene, camera);
}

animate();

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

function handleInput(x) {
    if (isGameOver) return;
    if (!isRunning) {
        startGame();
        return;
    }

    const w = window.innerWidth;
    if (x < w * 0.3) {
        character.moveLane(-1);
    } else if (x > w * 0.7) {
        character.moveLane(1);
    } else {
        character.jump();
    }
}

// Input Events
window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'BUTTON') handleInput(e.clientX);
});

window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    if (!isRunning) {
        if(['Space','ArrowUp','KeyW','ArrowLeft','ArrowRight'].includes(e.code)) startGame();
        return;
    }
    
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') character.moveLane(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') character.moveLane(1);
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') character.jump();
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
    character.lane = 0;
    character.targetX = 0;
    character.runSpeed = 16;
    character.isGrounded = false;
    level.reset();
    uiGameOver.classList.remove('visible');
    uiScore.innerText = "SCORE: 0";
    hintEl.style.opacity = 1;
});

// Game Loop
function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1);
    
    const alive = character.update(dt, level.platforms, isRunning);
    level.update(character.position.z);

    // Camera
    const camZ = character.position.z + 8;
    const camY = character.position.y + 4;
    
    camera.position.z = camZ;
    camera.position.y += (camY - camera.position.y) * 5 * dt;
    camera.position.x += (character.position.x * 0.4 - camera.position.x) * 4 * dt;
    camera.rotation.z = -character.lane * 0.05; // Slight tilt
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

