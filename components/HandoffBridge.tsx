'use client';

// ボドゲ広場の「別タブで大きく開く」を押したとき、iframe で遊んでいた続きから
// 始められるようにするための橋渡し。
//
// このゲームは boardgamecat.com のページに iframe で埋め込まれている。
// 「別タブで大きく開く」のリンク先はゲームのトップページなので、
// iframe の中でオンラインの部屋に入っていても、新しいタブは部屋の外から始まる。
//
// このゲームは自分が部屋の中の誰なのかをURL（?pid=...）で持っているので、
// 今いるページをそのまま親ページへ知らせれば足りる。保存領域は使わない。
//
//   親 → こちら : { type: 'bodoge:whoami' }
//   こちら → 親 : { type: 'bodoge:session', path }

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** 親ページへ知らせるときの合図。ボドゲ広場側と揃えること。 */
const TELL = 'bodoge:session';
/** 親ページから「今どこ？」と聞かれるときの合図。 */
const ASK = 'bodoge:whoami';

/**
 * 別タブで開き直しても成り立つページだけを渡す。
 *
 * CPU対戦の部屋（online=1 が付かない /r/...）は途中経過を
 * sessionStorage に持っているだけで、サーバーには何も無い。
 * sessionStorage はタブごとに独立する仕様なので、別タブで開いても
 * 続きは見つからずトップページへ戻されてしまう。それなら最初から
 * トップページを開いたほうがよいので渡さない。
 */
function handoffPath(): string {
  const { pathname, search } = window.location;
  if (pathname.startsWith('/r/') || pathname.startsWith('/game/')) {
    return new URLSearchParams(search).get('online') === '1' ? pathname + search : '';
  }
  if (pathname.startsWith('/lobby')) return pathname + search;
  return '';
}

function inIframe(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

export default function HandoffBridge() {
  // 部屋へ移動したらまた知らせたいので、ページが変わるたびに動かす。
  const pathname = usePathname();

  useEffect(() => {
    if (!inIframe()) return;

    const tell = () => {
      // 宛先オリジンは絞らない（'*'）。ボドゲ広場は www 付きでも開けるため。
      // 渡すのは今いるページだけで、親の受け取り側はこちらのオリジンを
      // 確認し、相対パスであることも確かめてから使う。
      try {
        window.parent.postMessage({ type: TELL, path: handoffPath() }, '*');
      } catch {
        // 親に届かなくても遊ぶぶんには支障がない
      }
    };

    tell();

    // 親から聞かれたときにも答える。iframe の読み込みが終わった合図は
    // 親側のほうが確実に取れるため。
    const onMessage = (ev: MessageEvent) => {
      if (ev.data && typeof ev.data === 'object' && ev.data.type === ASK) tell();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pathname]);

  return null;
}
