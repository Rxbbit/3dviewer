import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let sphereMesh = null;
const fileInput = document.getElementById('file-input');
const loadingOverlay = document.getElementById('loading-overlay');
const sceneListPanel = document.getElementById('scene-list');
const sceneItemsContainer = document.getElementById('scene-items');
const toggleScenesBtn = document.getElementById('toggle-scenes');
const toggleControlsBtn = document.getElementById('toggle-controls');
const closeControlsBtn = document.getElementById('close-controls'); // New X button
const controlsPanel = document.getElementById('controls-help');

let scenes = []; // Array of { name, url, file }
let currentSceneIndex = -1;

init();
animate();

function init() {
    // Signal liveness to index.html
    window.appLoaded = true;
    console.log("App initialized");

    // Ensure canvas exists
    const canvas = document.querySelector('#canvas');

    // 1. Scene
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Important for HDR
    renderer.toneMappingExposure = 1.0;

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // Disable OrbitControls zoom (dolly) to use custom FOV zoom
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = -0.5;

    // Custom Zoom (FOV) - Wheel
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const fovMin = 30;
        const fovMax = 100;
        const sensitivity = 0.05;

        camera.fov += event.deltaY * sensitivity;
        camera.fov = Math.max(fovMin, Math.min(fovMax, camera.fov));
        camera.updateProjectionMatrix();
    }, { passive: false });

    // Custom Zoom (FOV) - Touch (Pinch)
    let initialPinchDistance = null;
    let initialFov = null;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
            initialFov = camera.fov;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault(); // Prevent page scroll
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);

            // Calculate zoom factor
            // Distance increase -> Zoom IN (FOV decrease), so we subtract
            const diff = initialPinchDistance - currentDistance;
            const sensitivity = 0.2;

            let newFov = initialFov + diff * sensitivity;
            newFov = Math.max(30, Math.min(100, newFov));

            camera.fov = newFov;
            camera.updateProjectionMatrix();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        initialPinchDistance = null;
    });

    // 5. Initial Placeholder
    createSphere();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);

    // Explicitly attach listener if element exists
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            console.log("File input changed:", e.target.files);
            handleFileUpload(e);
        });
    }

    // Toggle Scenes
    if (toggleScenesBtn && sceneListPanel) {
        toggleScenesBtn.addEventListener('click', () => {
            sceneListPanel.classList.toggle('hidden');
        });
    }

    // Toggle Controls (Unified)
    if (toggleControlsBtn && controlsPanel) {
        toggleControlsBtn.addEventListener('click', () => {
            controlsPanel.classList.toggle('hidden');
        });
    }

    // Close Controls Button (Desktop/Mobile X button)
    if (closeControlsBtn && controlsPanel) {
        closeControlsBtn.addEventListener('click', (e) => {
            // Stop propagation to prevent hitting underlying elements if they overlap
            e.stopPropagation();
            controlsPanel.classList.add('hidden');
        });
    }

    // Rotation Controls

}

function createSphere(texture = null) {
    if (sphereMesh) {
        scene.remove(sphereMesh);
        sphereMesh.geometry.dispose();
        if (sphereMesh.material.map) sphereMesh.material.map.dispose();
        sphereMesh.material.dispose();
    }

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: texture ? 0xffffff : 0x333333,
        side: THREE.FrontSide // Scale -1 already flips faces inward, so we view the Front
    });

    sphereMesh = new THREE.Mesh(geometry, material);
    scene.add(sphereMesh);
}

function showLoading(show) {
    if (!loadingOverlay) return;
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        console.warn("No files selected");
        return;
    }

    console.log(`Processing ${files.length} files`);

    // Convert FileList to Array and process
    const newScenes = Array.from(files).map(file => ({
        name: file.name,
        file: file,
        url: URL.createObjectURL(file)
    }));

    // Add to scenes array
    const startIndex = scenes.length;
    scenes = [...scenes, ...newScenes];

    // Show the sidebar if hidden
    if (sceneListPanel) sceneListPanel.classList.remove('hidden');

    // Render list
    renderSceneList();

    // If no scene was active, load the first new one
    if (currentSceneIndex === -1) {
        loadScene(startIndex);
    }

    // Reset input so same files can be selected again if needed (though tricky with multiple)
    event.target.value = '';
}

function renderSceneList() {
    if (!sceneItemsContainer) return;

    sceneItemsContainer.innerHTML = '';

    scenes.forEach((sceneData, index) => {
        const item = document.createElement('div');
        item.className = `scene-item ${index === currentSceneIndex ? 'active' : ''}`;
        item.textContent = sceneData.name;
        item.onclick = () => loadScene(index);
        sceneItemsContainer.appendChild(item);
    });
}

function loadScene(index) {
    if (index < 0 || index >= scenes.length) return;

    currentSceneIndex = index;
    renderSceneList(); // Update active state

    const sceneData = scenes[index];
    showLoading(true);

    const extension = sceneData.name.split('.').pop().toLowerCase();
    const url = sceneData.url;

    const onLoad = (texture) => {
        console.log(`Texture ${sceneData.name} loaded successfully`);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;

        createSphere(texture);
        showLoading(false);
    };

    const onError = (err) => {
        console.error("Error loading texture:", err);
        alert(`Error loading image: ${err.message || 'Invalid format'}`);
        showLoading(false);
    };

    if (extension === 'hdr') {
        const loader = new RGBELoader();
        loader.load(url, (texture) => {
            console.log("HDR loaded");
            createSphere(texture);
            showLoading(false);
        }, undefined, onError);
    } else {
        const loader = new THREE.TextureLoader();
        loader.load(url, onLoad, undefined, onError);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
