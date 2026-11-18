export const dynamicRows = String.raw`
drill.sequence|{rotate} 順轉一次，再按 {drop} 硬降。|{rotate} 顺转一次，再按 {drop} 硬降。|Rotate once with {rotate}, then hard-drop with {drop}.|{rotate} で一度右に回して、{drop} でハードドロップ。|{rotate}로 한 번 회전한 후 {drop}로 하드 드롭.
drill.rule1|① {key} 順時針旋轉|① {key} 顺时针旋转|① {key} rotate clockwise|① {key} で右回転|① {key} 시계 방향 회전
drill.rule2|② {key} 硬降，完成雙消|② {key} 硬降，完成双消|② {key} hard drop for a double|② {key} でハードドロップ、2 行消去|② {key} 하드 드롭으로 2줄 제거
drill.fail1|先按 {key} 順轉一次，|先按 {key} 顺转一次，|First rotate once with {key},|まず {key} で一度右回転、|먼저 {key}로 한 번 회전하고,
drill.fail2|確認卡進洞裡，再按 {key} 硬降。|确认进入空隙，再按 {key} 硬降。|Check the fit, then press {key} to hard drop.|すき間に入ったら {key} でハードドロップ。|빈자리에 들어갔는지 확인한 후 {key}로 하드 드롭.
hold.storeDesc|按 {keys}，或點棋盤左側的「暫存交換」。目前的 {piece} 方塊會進 HOLD，NEXT 的下一顆會上場。|按 {keys}，或点击棋盘左侧的「暂存交换」。当前的 {piece} 方块会进入 HOLD，NEXT 的下一颗会登场。|Press {keys} or Hold left of the board. Store the {piece} piece and bring in the NEXT piece.|{keys} または盤面左のホールドを押すと、{piece} を保存し、NEXT のブロックが出ます。|{keys} 또는 보드 왼쪽 홀드를 누르세요. {piece} 블록을 보관하고 NEXT 블록을 가져옵니다.
hold.placeDesc|{piece} 已存好。現在還不能再交換；先把這顆放好，按 {key} 硬降並固定。|{piece} 已存好。当前还不能交换；先摆好这颗，按 {key} 硬降并固定。|{piece} is stored. Place this piece and press {key} to hard drop before swapping again.|{piece} を保存しました。まず今のブロックを配置し、{key} で固定すると再び交換できます。|{piece} 보관 완료. 현재 블록을 배치하고 {key}로 고정해야 다시 교체할 수 있습니다.
hold.swapDesc|交換已解鎖。再按 {keys} 或點「暫存交換」，取回剛剛存好的 {piece}。|交换已解锁。再按 {keys} 或点击「暂存交换」，取回刚才存好的 {piece}。|Hold is ready. Press {keys} or Hold to retrieve your {piece} piece.|交換できます。{keys} またはホールドを押して、{piece} を取り出しましょう。|홀드가 해제되었습니다. {keys} 또는 홀드를 눌러 {piece} 블록을 가져오세요.
hold.doneDesc|你把 {piece} 換回來了。第一次暫存取 NEXT，之後交換 HOLD；每顆固定後才會再次解鎖。|你把 {piece} 换回来了。第一次暂存取 NEXT，之后交换 HOLD；每颗固定后才会再次解锁。|You brought {piece} back. The first hold takes from NEXT; later holds swap with HOLD. Each placement unlocks it again.|{piece} を取り戻しました。最初は NEXT から、その後は HOLD と交換します。固定するたびに再び使えます。|{piece} 블록을 가져왔습니다. 첫 홀드는 NEXT에서 가져오고 이후에는 HOLD와 교체합니다. 고정할 때마다 다시 사용할 수 있습니다.
practice.summary|你放了 {pieces} 塊，消掉 {lines} 行。|你放了 {pieces} 块，消掉 {lines} 行。|You placed {pieces} pieces and cleared {lines} lines.|{pieces} 個を置き、{lines} 行消しました。|블록 {pieces}개를 놓고 {lines}줄을 지웠습니다.
result.cancelled|你抵消了 {count} 行來襲攻擊。|你抵消了 {count} 行来袭攻击。|You cancelled {count} incoming lines.|到着待ちの {count} 行を相殺しました。|들어오는 공격 {count}줄을 상쇄했습니다.
result.cpuSeparator|行 · CPU|行 · CPU|lines · CPU|行 · CPU|줄 · CPU
hold.aria|暫存交換，{stored}。{status}。按鍵 {keys}。每顆固定後才會解鎖。|暂存交换，{stored}。{status}。按键 {keys}。每颗固定后才会解锁。|Hold, {stored}. {status}. Keys: {keys}. Unlocks after each placement.|ホールド、{stored}。{status}。キー：{keys}。固定後に解除されます。|홀드, {stored}. {status}. 키: {keys}. 고정 후 잠금이 해제됩니다.
hold.stored|目前存放 {piece} 方塊|当前存放 {piece} 方块|{piece} piece stored|{piece} を保存中|{piece} 블록 보관 중
hold.currentEmpty|目前空位|当前为空|Currently empty|現在は空き|현재 비어 있음
hold.once|每顆落子只能交換一次|每颗落子只能交换一次|One hold per placement|固定まで 1 回のみ交換可能|고정마다 한 번 교체 가능
binding.aria|重新設定{action}按鍵，目前 {key}|重新设置{action}按键，当前为 {key}|Rebind {action}, currently {key}|{action} のキーを変更。現在 {key}|{action} 키 변경, 현재 {key}
controls.aliasDynamic|順轉 {cw} · 暫存交換 {hold} · 暫停 {pause}。軟降到底仍可轉；硬降後就固定。|顺转 {cw} · 暂存交换 {hold} · 暂停 {pause}。软降到底仍可转；硬降后就固定。|Rotate {cw} · hold {hold} · pause {pause}. Rotate after soft drop; hard drop locks.|右回転 {cw} · ホールド {hold} · 一時停止 {pause}。ソフトドロップ後は回転可能、ハードドロップは固定。|회전 {cw} · 홀드 {hold} · 일시정지 {pause}. 소프트 드롭 후 회전 가능, 하드 드롭은 고정.
controls.boardAria|你的方塊棋盤。{left}與{right}移動，{soft}軟降，{ccw}逆時針，{cw}順時針，{hard}硬降並立即固定，{hold}暫存交換，{pause}暫停。|你的方块棋盘。{left}和{right}移动，{soft}软降，{ccw}逆时针，{cw}顺时针，{hard}硬降并立即固定，{hold}暂存交换，{pause}暂停。|Your board. {left} and {right} move; {soft} soft drop; {ccw} rotate left; {cw} rotate right; {hard} hard drop and lock; {hold} hold; {pause} pause.|自分の盤面。{left} と {right} 移動、{soft} ソフトドロップ、{ccw} 左回転、{cw} 右回転、{hard} 即落下・固定、{hold} ホールド、{pause} 一時停止。|내 보드. {left}와 {right} 이동, {soft} 소프트 드롭, {ccw} 왼쪽 회전, {cw} 오른쪽 회전, {hard} 하드 드롭 및 고정, {hold} 홀드, {pause} 일시정지.
controls.touchAria|{action}{detail}。鍵盤 {keys}。|{action}{detail}。键盘 {keys}。|{action}{detail}. Keyboard: {keys}.|{action}{detail}。キー：{keys}。|{action}{detail}. 키보드: {keys}.
controls.hardDetail|，立即固定方塊|，立即固定方块|; lock the piece immediately|、ブロックを即固定|, 블록 즉시 고정
controls.softDetail|，落地後仍可旋轉|，落地后仍可旋转|; rotate after landing|、接地後も回転可能|, 착지 후에도 회전 가능
controls.holdDetail|，每顆落子只能一次|，每颗落子只能一次|; once per placement|、固定まで 1 回のみ|, 고정마다 한 번
help.dropDynamic|{soft} 會加快下落，接地後還有短暫時間可以旋轉。{hard} 直接落到底並固定；要轉進洞，先旋轉，再硬降。|{soft} 加快下落，接地后仍有短暂时间可以旋转。{hard} 直接落到底并固定；要转入空隙，先旋转，再硬降。|{soft} speeds up descent, with a brief rotation window after landing. {hard} drops and locks instantly. To fit a gap, rotate first, then hard drop.|{soft} で速く落下し、接地後もしばらく回転できます。{hard} は即落下・固定。すき間へ入れるには先に回転してからハードドロップ。|{soft}로 빠르게 내리고 착지 후 잠깐 회전할 수 있습니다. {hard}는 즉시 낙하하여 고정합니다. 빈자리에는 먼저 회전한 후 하드 드롭하세요.
help.spinDynamic|T-Spin 道場已排好局面。按 {rotate} 順時針旋轉，再按 {hard} 固定，體驗轉進洞並消兩行。道場不會自動下落；交換方塊後請按 R 重擺，該次不計成功。|T-Spin 道场已摆好局面。按 {rotate} 顺时针旋转，再按 {hard} 固定，体验转入空隙并消两行。道场不会自动下落；交换方块后请按 R 重置，该次不计成功。|The T-Spin setup is ready. Rotate with {rotate}, then lock with {hard} for a double. There is no gravity. Swapping does not count as success; press R to reset.|T-Spin の配置は準備済み。{rotate} で右回転、{hard} で固定して 2 行消去。自動落下なし。交換した場合は成功にならないので R でリセットしてください。|T-Spin 배치가 준비되었습니다. {rotate}로 회전하고 {hard}로 고정해 두 줄을 지우세요. 자동 낙하는 없습니다. 블록 교체는 성공으로 인정되지 않으므로 R로 초기화하세요.
help.spinInitial|T-Spin 道場已排好局面。按 X 或 ↑ 順時針旋轉，再按 Space 固定，體驗轉進洞並消兩行。道場不會自動下落。|T-Spin 道场已摆好局面。按 X 或 ↑ 顺时针旋转，再按 Space 固定，体验转入空隙并消两行。道场不会自动下落。|The T-Spin setup is ready. Press X or ↑ to rotate, then Space to lock for a double. There is no gravity.|T-Spin の配置は準備済み。X または ↑ で右回転し、Space で固定して 2 行消去。自動落下はありません。|T-Spin 배치가 준비되었습니다. X 또는 ↑로 회전하고 Space로 고정해 두 줄을 지우세요. 자동 낙하는 없습니다.
help.holdDynamic|按 {keys}，或點棋盤左側的「暫存交換」。第一次存入目前方塊並取出 NEXT；之後與 HOLD 內的方塊交換。每顆落子只能一次，固定後才會解鎖；不能連按把下一顆一直洗掉。|按 {keys}，或点击棋盘左侧的「暂存交换」。第一次存入当前方块并取出 NEXT；之后与 HOLD 内方块交换。每颗落子只能一次，固定后才会解锁；不能连续跳过方块。|Press {keys} or Hold left of the board. First use stores the piece and takes from NEXT; later uses swap with HOLD. One hold per placement. You cannot repeatedly skip pieces.|{keys} または盤面左のホールドを押します。初回は今のブロックを保存して NEXT を取り出し、以後は HOLD と交換。固定まで 1 回だけで、連続して飛ばすことはできません。|{keys} 또는 보드 왼쪽 홀드를 누르세요. 첫 사용은 보관 후 NEXT에서 가져오며 이후에는 HOLD와 교체합니다. 고정 전에는 한 번만 가능하며 블록을 계속 건너뛸 수 없습니다.
help.holdInitial|按 C / Shift 或點棋盤左側的暫存交換。第一次存入目前方塊並取出 NEXT；之後與暫存方塊交換。每顆落子只能一次，固定後才會解鎖。|按 C / Shift 或点击棋盘左侧的暂存交换。首次存入当前方块并取出 NEXT；之后与暂存方块交换。每颗落子只能一次，固定后才会解锁。|Press C / Shift or Hold left of the board. First use stores the piece and takes from NEXT; later uses swap with HOLD. One hold per placement.|C / Shift または盤面左のホールド。初回は保存して NEXT を取り出し、以後は保存したブロックと交換。固定まで 1 回のみ使えます。|C / Shift 또는 보드 왼쪽 홀드를 누르세요. 첫 사용은 보관 후 NEXT에서 가져오고 이후에는 보관한 블록과 교체합니다. 고정마다 한 번 가능합니다.
party.itemAria|{name}，{description}，{cost} 能量。{status}。按 {key}|{name}，{description}，{cost} 能量。{status}。按 {key}|{name}, {description}, {cost} energy. {status}. Press {key}|{name}、{description}、{cost} エネルギー。{status}。キー {key}|{name}, {description}, 에너지 {cost}. {status}. {key} 키
party.itemAriaNoKey|{name}，{description}，{cost} 能量。{status}|{name}，{description}，{cost} 能量。{status}|{name}, {description}, {cost} energy. {status}|{name}、{description}、{cost} エネルギー。{status}|{name}, {description}, 에너지 {cost}. {status}
game.readyEn|準備就緒|准备就绪|READY|READY|준비 완료
game.pausedEn|暫停|暂停|PAUSED|PAUSED|일시정지
game.finishedEn|結束|结束|FINISHED|FINISHED|종료
game.soloEn|單人|单人|SOLO|SOLO|싱글
game.playerEn|玩家|玩家|PLAYER|プレイヤー|플레이어
game.yourFieldEn|你的棋盤|你的棋盘|YOUR FIELD|自分の盤面|내 보드
game.opponentEn|對手|对手|OPPONENT|対戦相手|상대
game.nextEn|下一顆|下一颗|NEXT|NEXT|다음
game.holdEn|暫存|暂存|HOLD|HOLD|홀드
game.comboEn|連擊|连击|COMBO|コンボ|콤보
game.findFlow|找回你的節奏|找回你的节奏|FIND YOUR FLOW|自分のリズムを|나만의 리듬을
game.nextMove|下一手，由你決定|下一步，由你决定|THE NEXT MOVE IS YOURS|次の一手はあなたが決める|다음 수는 당신의 것
game.earlyPlaytest|早期試玩|早期试玩|EARLY PLAYTEST|早期プレイテスト|초기 플레이테스트
game.signatureEn|招牌一轉|招牌一转|THE SIGNATURE MOVE|決め手の回転|결정적인 회전
game.feelRightEn|調整你的手感|调整你的操作|MAKE IT FEEL RIGHT|自分に合う操作感へ|내 손에 맞는 조작
game.soundEn|聽見下一手|听见下一步|SOUND OF YOUR NEXT MOVE|次の一手の音|다음 수의 소리
game.moreRotationEn|再轉一次|再转一次|ONE MORE ROTATION|もうひと回転|한 번 더 회전
game.beyondEn|從熟悉走向更多|从熟悉走向更多|BEYOND THE NOSTALGIA|懐かしさの、その先へ|추억을 넘어
game.makeMoveEn|換你出招|轮到你出招|MAKE YOUR NEXT MOVE|次の一手を|다음 수를 두세요
game.takeTimeEn|慢慢來|慢慢来|TAKE YOUR TIME|ゆっくりでいい|천천히 하세요
game.lastSpinEn|最後一轉|最后一转|ONE LAST SPIN|最後のひと回転|마지막 한 번의 회전
game.breathEn|先休息一下|先休息一下|TAKE A BREATH|ひと息つこう|잠시 숨을 고르세요
game.feelingEn|就是這個感覺|就是这个感觉|THAT’S THE FEELING|この感覚だ|바로 이 느낌
game.resetEn|重擺局面|重置局面|RESET THE POSITION|配置をリセット|배치 초기화
game.tryEn|再試一次|再试一次|ONE MORE TRY|もう一度挑戦|한 번 더 도전
game.keepMovesEn|留下好的一手|保留出色的一步|KEEP THE GOOD MOVES|よかった一手を残そう|좋은 수를 기억하세요
game.evenEn|勢均力敵|势均力敌|EVENLY MATCHED|互角の勝負|막상막하
game.counterEn|你的反擊|你的反击|YOUR COUNTERPLAY|あなたの反撃|나의 반격
game.nextYoursEn|下一局，換你贏|下一局，轮到你赢|THE NEXT ONE IS YOURS|次はあなたの番|다음 승리는 당신의 것
game.cpuSentOnly|CPU 淨送出 {sent} 行|CPU 净送出 {sent} 行|CPU sent {sent}|CPU 送信 {sent} 行|CPU 전송 {sent}줄
game.incomingOnly|待抵消 {incoming} 行|待抵消 {incoming} 行|Incoming {incoming}|相殺待ち {incoming} 行|대기 {incoming}줄
`.trim().split('\n').map(line=>line.split('|'));
