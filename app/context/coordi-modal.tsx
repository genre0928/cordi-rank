import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface CoordiModalContextValue {
  id: number | null;
  open: (id: number) => void;
  close: () => void;
}

const CoordiModalContext = createContext<CoordiModalContextValue | null>(null);

/**
 * 카드 클릭 시 페이지 이동 없이 상세 정보를 모달로 띄우기 위한 전역 상태.
 * root.tsx에서 앱 전체를 감싸고, CoordiDetailModal이 이 상태를 읽어 렌더링한다.
 */
export function CoordiModalProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<number | null>(null);
  const value = useMemo(() => ({ id, open: setId, close: () => setId(null) }), [id]);

  return <CoordiModalContext.Provider value={value}>{children}</CoordiModalContext.Provider>;
}

export function useCoordiModal(): CoordiModalContextValue {
  const ctx = useContext(CoordiModalContext);
  if (!ctx) throw new Error("useCoordiModal은 CoordiModalProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}
