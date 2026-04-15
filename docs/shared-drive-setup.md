# 공유 드라이브 (TwinverseFolder) 설정

3대의 개발 PC 가 Orbitron 서버의 Samba 공유 폴더를 `Z:` 드라이브로 마운트해서
공용 파일(레퍼런스, pak, 빌드 결과물 등)을 주고받는다.

## 서버 측 (Orbitron · 192.168.219.101)

- Samba 공유: `[TwinverseFolder]` (`/etc/samba/smb.conf`)
- 실제 경로: `/srv/TwinverseFolder`
- 자격 증명 파일: `/etc/samba/twinverse.cred` (root 전용, `username=` / `password=` 형식)
- Samba 사용자: `twinverse` (Linux uid 1001, `pdbedit -L` 로 확인)

비밀번호 확인/변경은 Orbitron 에서:

```bash
sudo cat /etc/samba/twinverse.cred      # 평문 참조
sudo smbpasswd twinverse                # 비밀번호 재설정
sudo systemctl restart smbd             # 변경 후 재기동
```

## Windows 클라이언트 자동 연결 설정

**매핑과 자격 증명을 반드시 둘 다 심어야** 재부팅 후에도 자동 연결된다.
매핑만 `/persistent:yes` 로 해도 credential 이 없으면 부팅 후 깨진다.

관리자 권한 필요 없음. 사용자 cmd 에서:

```cmd
REM 1. 자격 증명 영구 저장 (서버 IP 기준)
cmdkey /add:192.168.219.101 /user:twinverse /pass:<실제비밀번호>

REM 2. Z: 드라이브 매핑 (영구)
net use Z: \\192.168.219.101\TwinverseFolder /user:twinverse <실제비밀번호> /persistent:yes

REM 3. 확인
net use
```

실제 비밀번호는 Orbitron `/etc/samba/twinverse.cred` 에서 조회할 것. 이 문서에는
평문으로 적지 않는다.

## 확인

```cmd
dir Z:\
```

파일이 보이면 성공. 부팅 직후 탐색기에서 Z: 가 "연결 안 됨" 으로 뜨는 경우
`net use Z:` 출력에서 상태가 "사용할 수 없습니다" 면 아래 **문제 해결** 로.

## 문제 해결

### Windows 가 암호를 다시 묻는다

증상: 탐색기에서 Z: 또는 `\\192.168.219.101\TwinverseFolder` 열면 "네트워크 자격 증명
입력" 창이 뜨고 올바른 비밀번호를 넣어도 "암호가 맞지 않습니다" 가 나온다.

원인: cmdkey 자격이 날아갔거나 처음부터 저장되지 않음.

확인:
```cmd
cmdkey /list | findstr 192.168.219.101
```
아무것도 안 나오면 자격 없음. 위 **자동 연결 설정** 1~2단계 재실행.

### 매핑은 OK 인데 실제로 파일이 안 보인다

- Orbitron `smbd` 가 죽었을 수 있음 → `ssh stevenlim@192.168.219.101 "systemctl status smbd"`
- 네트워크(공유기·VPN) 경로 문제 → `ping 192.168.219.101`
- 방화벽이 445 포트 막았는지 → `Test-NetConnection 192.168.219.101 -Port 445` (PowerShell)

### 다른 계정으로 이전에 연결한 기록이 남아서 충돌

```cmd
net use Z: /delete /y
cmdkey /delete:192.168.219.101
```
초기화 후 **자동 연결 설정** 부터 재실행.

## 변경 이력

- 2026-04-14: 3-PC 공유용으로 최초 구성 (Orbitron Samba + Z: 매핑)
- 2026-04-15: 자격 증명이 날아가서 재설정, 본 문서 작성 (cmdkey 단계 누락이
  재발 원인 → 문서화로 방지)
