/**
 * ============================================================================
 * FILE: client/src/components/lobby/MeshNetworkCanvas.jsx
 * PURPOSE: Interactive WebRTC Mesh & Future SFU Topology Engine
 * 
 * CORE RESPONSIBILITIES:
 * 1. Visualizes peer-to-peer mesh interconnects and central SFU relay routers.
 * 2. Emits traveling ICE/media stream packets with dynamic packet tags.
 * 3. High-contrast translucent glow to stay crisp and visible through glass cards.
 * ============================================================================
 */

import React, { useRef, useEffect } from 'react';

export const MeshNetworkCanvas = ({ architecture = 'mesh' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const mouse = { x: width / 2, y: height / 2, radius: 180 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Dynamic Peer Nodes
    const nodeCount = Math.min(22, Math.max(14, Math.floor(width / 70)));
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.9,
      vy: (Math.random() - 0.5) * 0.9,
      radius: i === 0 ? 6 : Math.random() * 2.5 + 2.5,
      pulse: Math.random() * Math.PI,
      isSFURelay: i === 0, // Central router when in SFU mode
      label: i === 0 ? 'SFU-CORE-GATEWAY' : i % 4 === 0 ? `EDGE-STUN-${i}` : null,
      bitrate: `${Math.floor(Math.random() * 400 + 800)} kbps`,
    }));

    // Data packet animations (Audio/Video Streams & ICE handshakes)
    const packets = [];
    const spawnPacket = () => {
      if (nodes.length < 2) return;
      let fromIdx, toIdx;

      if (architecture === 'sfu') {
        // SFU mode: packets flow to and from central node
        if (Math.random() > 0.5) {
          fromIdx = 0;
          toIdx = Math.floor(Math.random() * (nodes.length - 1)) + 1;
        } else {
          fromIdx = Math.floor(Math.random() * (nodes.length - 1)) + 1;
          toIdx = 0;
        }
      } else {
        // Full Mesh mode: peer-to-peer links
        fromIdx = Math.floor(Math.random() * nodes.length);
        toIdx = Math.floor(Math.random() * nodes.length);
        while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * nodes.length);
      }

      packets.push({
        from: nodes[fromIdx],
        to: nodes[toIdx],
        progress: 0,
        speed: 0.012 + Math.random() * 0.018,
        color: Math.random() > 0.5 ? '#06b6d4' : '#10b981', // Cyan / Emerald stream
        type: Math.random() > 0.5 ? 'OPUS' : 'H264',
      });
    };

    let timer = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Lock SFU Core node to center when in SFU mode
      if (architecture === 'sfu') {
        nodes[0].x += (width / 2 - nodes[0].x) * 0.05;
        nodes[0].y += (height / 2 - nodes[0].y) * 0.05;
      }

      // 1. Move and update nodes
      nodes.forEach((node, i) => {
        if (architecture === 'sfu' && i === 0) return;

        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 20 || node.x > width - 20) node.vx *= -1;
        if (node.y < 20 || node.y > height - 20) node.vy *= -1;

        // Mouse repelling physics
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (1 - dist / mouse.radius) * 2;
          node.x -= (dx / dist) * force;
          node.y -= (dy / dist) * force;
        }

        node.pulse += 0.04;
      });

      // 2. Draw topology links
      if (architecture === 'sfu') {
        // SFU Star Topology: Star hub connections
        const hub = nodes[0];
        for (let i = 1; i < nodes.length; i++) {
          const peer = nodes[i];
          const dist = Math.hypot(hub.x - peer.x, hub.y - peer.y);
          const alpha = Math.max(0.15, 1 - dist / (width * 0.7));

          ctx.beginPath();
          ctx.strokeStyle = `rgba(6, 182, 212, ${alpha * 0.6})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.moveTo(hub.x, hub.y);
          ctx.lineTo(peer.x, peer.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // Full WebRTC Mesh: P2P interconnects
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const maxDist = 240;
            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * 0.45;
              ctx.beginPath();
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
              ctx.lineWidth = 1.2;
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // 3. Draw and update media stream packets
      timer++;
      if (timer % 20 === 0 && packets.length < 24) {
        spawnPacket();
      }

      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        p.progress += p.speed;

        if (p.progress >= 1) {
          packets.splice(k, 1);
          continue;
        }

        const currX = p.from.x + (p.to.x - p.from.x) * p.progress;
        const currY = p.from.y + (p.to.y - p.from.y) * p.progress;

        // Glowing packet beam
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.arc(currX, currY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Render nodes & radar beacon rings
      nodes.forEach((node) => {
        const ringRadius = node.radius + Math.sin(node.pulse) * 6 + 6;

        ctx.beginPath();
        ctx.strokeStyle = node.isSFURelay && architecture === 'sfu'
          ? 'rgba(236, 72, 153, 0.45)'
          : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.arc(node.x, node.y, Math.max(0, ringRadius), 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = node.isSFURelay && architecture === 'sfu' ? '#ec4899' : '#38bdf8';
        ctx.shadowColor = node.isSFURelay && architecture === 'sfu' ? '#ec4899' : '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Node Telemetry label
        if (node.label) {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.font = '10px monospace';
          ctx.fillText(node.label, node.x + 10, node.y + 3);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [architecture]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-85"
    />
  );
};