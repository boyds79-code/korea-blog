#!/usr/bin/env node
// 사진 업로드 자동화 도우미.
// 하는 일: 열려있는 draft PR 브랜치를 찾아서 → 그 브랜치로 체크아웃 →
// public/images/blog/<slug>/ 폴더를 자동 생성 → Finder로 열어줌 →
// 사용자가 사진을 넣고 Enter를 누르면 자동으로 git add/commit/push.
//
// 실행: npm run photos

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

function runOrNull(cmd, opts = {}) {
  try {
    return run(cmd, opts);
  } catch {
    return null;
  }
}

async function main() {
  // 0. 이 스크립트가 프로젝트 루트에서 실행됐는지 확인
  if (!fs.existsSync('.git')) {
    console.error('❌ 이 프로젝트의 루트 폴더(.git이 있는 곳)에서 실행해주세요.');
    process.exit(1);
  }

  // 1. 커밋 안 된 변경사항이 있으면 중단 (실수로 덮어쓰는 것 방지)
  const status = runOrNull('git status --porcelain');
  if (status) {
    console.error('❌ 커밋되지 않은 변경사항이 있습니다. 먼저 정리(commit/stash)한 뒤 다시 실행해주세요.');
    console.error(status);
    process.exit(1);
  }

  console.log('🔄 원격 저장소 정보를 갱신하는 중...');
  run('git fetch origin --prune');

  // 2. draft/* 브랜치 목록 찾기
  const raw = runOrNull("git branch -r --list 'origin/draft/*'") || '';
  const branches = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^origin\//, ''));

  if (branches.length === 0) {
    console.log('현재 열려있는 draft PR이 없습니다. GitHub의 Pull requests 탭을 확인해보세요.');
    rl.close();
    return;
  }

  let branch;
  if (branches.length === 1) {
    branch = branches[0];
    console.log(`📌 draft PR 브랜치를 찾았습니다: ${branch}`);
  } else {
    console.log('여러 개의 draft PR이 열려 있습니다. 사진을 넣을 글을 선택하세요:');
    branches.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    const answer = await rl.question('번호 입력: ');
    const idx = parseInt(answer, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= branches.length) {
      console.error('❌ 잘못된 번호입니다.');
      rl.close();
      process.exit(1);
    }
    branch = branches[idx];
  }

  const slug = branch.replace(/^draft\//, '');

  // 3. 브랜치 체크아웃 (로컬에 이미 있으면 그대로, 없으면 origin에서 새로 생성)
  const localExists = runOrNull(`git rev-parse --verify ${branch}`);
  console.log(`🔀 브랜치로 전환하는 중: ${branch}`);
  if (localExists) {
    run(`git checkout ${branch}`);
    run(`git pull origin ${branch}`);
  } else {
    run(`git checkout -b ${branch} origin/${branch}`);
  }

  // 4. 사진 폴더 생성
  const targetDir = path.join('public', 'images', 'blog', slug);
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`📁 폴더 준비 완료: ${targetDir}`);

  // 5. 이 글에 필요한 사진 체크리스트 보여주기
  const mdPath = path.join('src', 'content', 'blog', `${slug}.md`);
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf-8');
    const match = content.match(/<!--([\s\S]*?)-->/);
    if (match) {
      console.log('\n📷 필요한 사진 목록:');
      console.log(match[1].trim());
      console.log('');
    }
  }

  // 6. Finder로 폴더 열기 (macOS 전용, 실패해도 무시)
  try {
    spawn('open', [targetDir], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // 무시 — Finder가 안 열려도 사용자가 직접 경로를 찾아가면 됨
  }

  console.log(`👉 방금 열린 Finder 창(${targetDir})에 위 체크리스트의 파일명 그대로 사진을 넣어주세요.`);
  await rl.question('사진을 다 넣었으면 Enter를 누르세요... ');

  // 7. 파일이 실제로 들어왔는지 확인
  const files = fs.readdirSync(targetDir).filter((f) => !f.startsWith('.'));
  if (files.length === 0) {
    console.log('⚠️  폴더가 비어있어서 중단합니다. 사진을 넣은 뒤 다시 실행해주세요.');
    rl.close();
    return;
  }
  console.log(`✅ 확인된 파일: ${files.join(', ')}`);

  // 8. git add / commit / push
  console.log('📤 커밋하고 업로드하는 중...');
  run(`git add ${targetDir}`);
  const commitResult = runOrNull(`git commit -m "Add photos for ${slug}"`);
  if (commitResult === null) {
    console.log('ℹ️  새로 커밋할 변경사항이 없습니다 (이미 커밋된 상태일 수 있어요).');
  }
  run(`git push origin ${branch}`);

  // 9. PR 링크 안내
  const remoteUrl = runOrNull('git remote get-url origin') || '';
  const m = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (m) {
    console.log(`\n🎉 완료! PR 페이지에서 확인하세요: https://github.com/${m[1]}/${m[2]}/pulls`);
  } else {
    console.log('\n🎉 완료! GitHub PR 페이지에서 사진이 반영됐는지 확인하세요.');
  }

  rl.close();
}

main().catch((err) => {
  console.error('❌ 오류 발생:', err.message);
  rl.close();
  process.exit(1);
});
