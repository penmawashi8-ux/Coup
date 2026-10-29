// 一定間隔で何かを取りに行く。ただし画面が見えている間だけ。
//
// このゲームは相手の手を知るために定期的にサーバーへ聞きに行く。
// その1回ごとが Vercel の CDNリクエスト（無料枠は月100万回）を消費する。
// 1.5秒おきなら1時間で2,400回。タブを開いたまま放置されると、
// 誰も見ていない画面のために延々と使い続けることになる。
//
// そこで隠れている間は止め、戻ってきたらすぐ1回取りに行く。
// 止めていた間に進んだぶんは、その1回で追いつく。

import { useEffect, useRef } from 'react';

/**
 * @param fn       取りに行く処理
 * @param everyMs  間隔。null を渡すと止まる（オンライン対戦でないときなど）
 */
export function usePolling(fn: () => void, everyMs: number | null): void {
  // fn は毎回新しい関数で来ることがある。これを依存に入れると
  // そのたびにタイマーを張り直してしまうので、入れ物に逃がす。
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (everyMs == null) return;

    const visible = () =>
      typeof document === 'undefined' || document.visibilityState === 'visible';

    const run = () => { if (visible()) latest.current(); };

    run();
    let timer = setInterval(run, everyMs);

    // 戻ってきたときは次の間隔を待たずに追いつく
    const onVisibility = () => {
      if (!visible()) return;
      clearInterval(timer);
      latest.current();
      timer = setInterval(run, everyMs);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [everyMs]);
}
