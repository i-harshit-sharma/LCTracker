import { useMemo, useRef } from "react";
import { Canvas, useFrame, RootState } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Float,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import {
  format,
  subDays,
  eachDayOfInterval,
  startOfWeek,
  isSameDay,
} from "date-fns";

interface BuildingProps {
  position: [number, number, number];
  height: number;
  color: string;
  delay: number;
}

function Building({ position, height, color, delay }: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state: RootState) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Subtle breathing animation
    const scale = 1 + Math.sin(time + delay) * 0.02;
    meshRef.current.scale.set(1, scale, 1);
  });

  return (
    <mesh ref={meshRef} position={[position[0], height / 2, position[2]]}>
      <boxGeometry args={[0.8, height, 0.8]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={height > 0.1 ? 0.2 : 0}
      />
    </mesh>
  );
}

interface ContributionCityProps {
  data: { date: string; count: number }[];
}

export function ContributionCity({ data }: ContributionCityProps) {
  const days = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 364);
    return eachDayOfInterval({ start, end });
  }, []);

  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => {
      const dateKey = format(new Date(d.date), "yyyy-MM-dd");
      map.set(dateKey, d.count);
    });
    return map;
  }, [data]);

  const getColor = (count: number) => {
    if (count === 0) return "#1e293b"; // muted/20
    if (count <= 1) return "#451a03"; // primary/30
    if (count <= 3) return "#92400e"; // primary/60
    if (count <= 5) return "#d97706"; // primary/80
    return "#f97316"; // primary
  };

  const getHeight = (count: number) => {
    if (count === 0) return 0.1;
    return 0.5 + count * 0.5;
  };

  const weeks = useMemo(() => {
    const weeksArr: Date[][] = [];
    let currentWeek: Date[] = [];

    const firstDay = days[0];
    const startOfFirstWeek = startOfWeek(firstDay, { weekStartsOn: 0 });

    const allDays = eachDayOfInterval({
      start: startOfFirstWeek,
      end: days[days.length - 1],
    });

    allDays.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    return weeksArr;
  }, [days]);

  return (
    <div className="w-full h-[500px] bg-slate-950 rounded-xl overflow-hidden border border-border/50 relative group">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-sm font-semibold text-white/90">
          Contribution City
        </h3>
        <p className="text-xs text-white/50">
          3D Visualization of your LeetCode progress
        </p>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera
          makeDefault
          position={[40, 40, 40]}
          fov={35}
          far={1000}
        />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.1}
          maxDistance={300}
          autoRotate
          autoRotateSpeed={0.5}
        />

        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 60, 250]} />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 20, 10]} intensity={1.5} castShadow />
        <spotLight
          position={[-10, 20, -10]}
          angle={0.15}
          penumbra={1}
          intensity={1}
          castShadow
        />

        <group position={[-weeks.length / 2, 0, -3.5]}>
          {weeks.map((week, weekIndex) => (
            <group key={weekIndex} position={[weekIndex, 0, 0]}>
              {week.map((day, dayIndex) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const count = dataMap.get(dateKey) || 0;
                const isVisible = days.some((d) => isSameDay(d, day));

                if (!isVisible) return null;

                return (
                  <Building
                    key={dayIndex}
                    position={[0, 0, dayIndex]}
                    height={getHeight(count)}
                    color={getColor(count)}
                    delay={weekIndex * 0.1 + dayIndex * 0.05}
                  />
                );
              })}
            </group>
          ))}

          {/* Floor */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[weeks.length / 2 - 0.5, -0.01, 3]}
            receiveShadow
          >
            <planeGeometry args={[weeks.length + 4, 10]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>

          <ContactShadows
            position={[weeks.length / 2 - 0.5, 0, 3]}
            opacity={0.4}
            scale={60}
            blur={2}
            far={10}
            resolution={256}
            color="#000000"
          />
        </group>

        <Environment preset="city" />
      </Canvas>

      <div className="absolute bottom-4 right-4 z-10 text-[10px] text-white/30 pointer-events-none uppercase tracking-widest">
        Drag to Rotate • Scroll to Zoom
      </div>
    </div>
  );
}
