import { MapPin } from "lucide-react";
import { useNavigation } from "react-router";

/**
 * 새로고침/페이지 이동으로 라우트 로더가 도는 동안(navigation.state !== "idle")
 * 화면 상단에 떠서 위에서 뚝 떨어져 통통 튀는 핀 아이콘을 보여주는 로딩 인디케이터.
 * 로딩이 얼마나 걸리든 애니메이션이 끊김 없이 반복되다가, 완료되면 즉시 사라진다.
 */
export function NavigationPinIndicator() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  if (!isNavigating) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center"
      role="status"
      aria-live="polite"
      aria-label="불러오는 중"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg dark:bg-gray-800">
        <MapPin
          className="h-5 w-5 animate-pin-drop-bounce text-orange-500"
          fill="currentColor"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
