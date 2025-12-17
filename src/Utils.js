import * as THREE from 'three';

export function createLimb(width, length, color) {
    const geometry = new THREE.CapsuleGeometry(width, length, 4, 8);
    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.4,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Create a pivot group so we can rotate around the end, not the center
    const pivot = new THREE.Group();
    // Offset the mesh so the pivot is at the top of the capsule
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    
    return { pivot, mesh };
}

export function createJoint(size, color) {
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
}

import * as THREE from 'three';

export function createLimb(width, length, color) {
    const geometry = new THREE.CapsuleGeometry(width, length, 4, 8);
    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Create a pivot group. 
    // Capsule is centered. To rotate from top, we shift mesh down by half length.
    const pivot = new THREE.Group();
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    
    return { pivot, mesh };
}

export function createJoint(size, color) {
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
}

import * as THREE from 'three';

export function createLimb(width, length, color) {
    const geometry = new THREE.CapsuleGeometry(width, length, 4, 8);
    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Create a pivot group. 
    // Capsule is centered at 0,0,0. To rotate from top, we shift mesh down by half length.
    const pivot = new THREE.Group();
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    
    return { pivot, mesh };
}

export function createJoint(size, color) {
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
}

