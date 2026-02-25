import { useState, useCallback } from 'react';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0
  });

  const show = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setState({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return {
    ...state,
    show,
    hide
  };
}
