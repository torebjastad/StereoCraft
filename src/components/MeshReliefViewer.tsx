import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MeshReliefViewerProps {
  depthMap: Float32Array;
  width: number;
  height: number;
}

export const MeshReliefViewer: React.FC<MeshReliefViewerProps> = ({
  depthMap,
  width,
  height,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 450;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, -120, 180);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Grid / Plane geometry for heightfield
    const gridX = Math.min(180, Math.floor(width / 4));
    const gridY = Math.min(135, Math.floor(height / 4));
    const planeW = 160;
    const planeH = 120;
    const geometry = new THREE.PlaneGeometry(planeW, planeH, gridX - 1, gridY - 1);

    // Displace vertices based on depthMap
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = (posAttr.getX(i) + planeW / 2) / planeW;
      const v = 1.0 - (posAttr.getY(i) + planeH / 2) / planeH;

      const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const py = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
      const zVal = depthMap[py * width + px] || 0;

      // Displace Z height
      posAttr.setZ(i, zVal * 28);
    }
    geometry.computeVertexNormals();

    // Material with sleek metallic/gradient shader appearance
    const material = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.25,
      metalness: 0.7,
      flatShading: false,
      wireframe: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x818cf8, 2.0);
    dirLight1.position.set(50, 80, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf43f5e, 1.2);
    dirLight2.position.set(-60, -80, 50);
    scene.add(dirLight2);

    // Interactive mouse drag to rotate
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotX = -0.55;
    let rotZ = 0;
    mesh.rotation.x = rotX;
    mesh.rotation.z = rotZ;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      rotZ += dx * 0.01;
      rotX += dy * 0.01;
      rotX = Math.max(-1.4, Math.min(0.2, rotX));
      mesh.rotation.x = rotX;
      mesh.rotation.z = rotZ;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isDragging) {
        mesh.rotation.z += 0.002; // gentle auto-turntable
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [depthMap, width, height]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center overflow-hidden rounded-xl">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg glass-card text-xs text-slate-300 pointer-events-none flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Drag with mouse to rotate 3D relief • Scroll to zoom
      </div>
    </div>
  );
};
