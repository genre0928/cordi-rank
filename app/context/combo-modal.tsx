import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ComboTarget {
  label: string;
  entryIds: number[];
}

interface ComboModalContextValue {
  target: ComboTarget | null;
  open: (target: ComboTarget) => void;
  close: () => void;
}

const ComboModalContext = createContext<ComboModalContextValue | null>(null);

/**
 * 프리즘/염색 조합 하나를 클릭했을 때, 그 조합과 일치하는 코디들을 모아 보여주는
 * 모달의 전역 상태. 단일 코디 상세를 띄우는 CoordiModalContext와는 별개로 둔다 —
 * 이 모달 안의 카드를 클릭하면 상세 모달을 또 띄우는 대신(모달 위에 모달이 쌓이는
 * 것을 피하려고) 상세 "페이지"로 이동시키기 때문에, 성격이 다른 팝업이라 컨텍스트도 분리했다.
 */
export function ComboModalProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ComboTarget | null>(null);
  const value = useMemo(() => ({ target, open: setTarget, close: () => setTarget(null) }), [target]);

  return <ComboModalContext.Provider value={value}>{children}</ComboModalContext.Provider>;
}

export function useComboModal(): ComboModalContextValue {
  const ctx = useContext(ComboModalContext);
  if (!ctx) throw new Error("useComboModal은 ComboModalProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}
