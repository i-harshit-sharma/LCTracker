import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, RootState } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Text, Float, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";

interface UserBuildingProps {
  position: [number, number, number];
  height: number;
  solvedCount: number;
  color: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  delay: number;
}

function UserBuilding({ position, height, solvedCount, color, username, displayName, avatarUrl, delay }: UserBuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state: RootState) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const scale = 1 + Math.sin(time + delay) * (hovered ? 0.05 : 0.02);
    meshRef.current.scale.set(1, scale, 1);
  });

  return (
    <group position={position}>
      <mesh 
        ref={meshRef} 
        position={[0, height / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.5, height, 1.5]} />
        <meshStandardMaterial 
          color={hovered ? "#fb923c" : color} 
          roughness={0.1} 
          metalness={0.9}
          emissive={hovered ? "#fb923c" : color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>

      {/* Floating Username */}
      <Text
        position={[0, height + 1, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
      >
        {displayName || username}
      </Text>

      {hovered && (
        <Html distanceFactor={15} position={[0, height + 2, 0]}>
          <div className="bg-slate-900/95 border border-primary/50 text-white p-3 rounded-lg shadow-2xl backdrop-blur-md min-w-[150px] pointer-events-none">
            <div className="flex items-center gap-2 mb-2">
              {avatarUrl ? (
                <img src={avatarUrl} className="h-8 w-8 rounded-full ring-1 ring-primary" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                  {username[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-bold leading-tight">{displayName || username}</p>
                <p className="text-[10px] text-white/50">@{username}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Total Solved</span>
              <span className="text-sm font-bold text-primary">{solvedCount}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

interface CommunityCityProps {
  data: { 
    leetcodeUsername: string; 
    solvedInPeriod: number; 
    avatarUrl?: string | null; 
    displayName?: string | null 
  }[];
}

export function CommunityCity({ data }: CommunityCityProps) {
  // Sort data to place tallest buildings in the center or back
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.solvedInPeriod - a.solvedInPeriod);
  }, [data]);

  const gridLayout = useMemo(() => {
    const count = sortedData.length;
    const size = Math.ceil(Math.sqrt(count));
    const layout = [];
    
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / size);
      const col = i % size;
      layout.push({
        x: (col - size / 2) * 3,
        z: (row - size / 2) * 3,
        ...sortedData[i]
      });
    }
    return layout;
  }, [sortedData]);

  const getColor = (index: number) => {
    if (index === 0) return "#fbbf24"; // Gold for #1
    if (index === 1) return "#94a3b8"; // Silver for #2
    if (index === 2) return "#b45309"; // Bronze for #3
    return "#f97316"; // Primary orange for others
  };

  const getHeight = (solved: number) => {
    return Math.max(0.5, Math.sqrt(solved) * 0.7);
  };

  return (
    <div className="w-full h-[600px] bg-slate-950 rounded-xl overflow-hidden border border-border/50 relative group">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-white tracking-tight">Community Skyline</h3>
        <p className="text-sm text-white/40">Leaderboard represented in 3D space</p>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[30, 30, 30]} fov={40} far={1000} />
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          maxDistance={200}
          autoRotate={false}
        />
        
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 50, 200]} />

        <ambientLight intensity={0.4} />
        <spotLight position={[20, 40, 20]} angle={0.2} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-10, 10, -10]} intensity={1} color="#3b82f6" />

        <group>
          {gridLayout.map((user, i) => (
            <UserBuilding 
              key={user.leetcodeUsername}
              position={[user.x, 0, user.z]}
              height={getHeight(user.solvedInPeriod)}
              solvedCount={user.solvedInPeriod}
              color={getColor(i)}
              username={user.leetcodeUsername}
              displayName={user.displayName || null}
              avatarUrl={user.avatarUrl || null}
              delay={i * 0.2}
            />
          ))}
          
          {/* Floor Grid */}
          <gridHelper args={[100, 50, "#1e293b", "#0f172a"]} position={[0, -0.05, 0]} />
          
          {/* Reflective Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.5} />
          </mesh>
          
          <ContactShadows 
            position={[0, 0, 0]}
            opacity={0.4}
            scale={100}
            blur={2.5}
            far={10}
            color="#000000"
          />
        </group>
        
        <Environment preset="night" />
      </Canvas>
      
      <div className="absolute bottom-6 right-6 z-10 text-[10px] text-white/20 pointer-events-none uppercase tracking-[0.2em]">
        Hover for details • Orbit to explore
      </div>
    </div>
  );
}
