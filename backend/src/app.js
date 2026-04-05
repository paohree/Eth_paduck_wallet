// app.js — Express 앱 설정
// 미들웨어, CORS, 라우터를 등록한다. server.js가 이 앱을 포트에 올린다.

"use strict";

const express = require("express");
const cors = require("cors");
const config = require("./config");
const balanceRouter = require("./routes/balance");

const app = express();

// 프록시(Nginx 등) 뒤에 배포될 경우 req.ip가 실제 클라이언트 IP를 반환하도록 설정.
// rate limiting의 IP 기반 식별에 필요하다.
app.set("trust proxy", 1);

app.use(express.json());

// CORS: 허용된 출처(프론트엔드 주소)에서 오는 요청만 브라우저가 처리할 수 있게 한다.
// allowedOrigin을 환경변수로 관리해 개발/배포 환경 구분 없이 코드 변경 없이 적용한다.
app.use(
  cors({
    origin: config.allowedOrigin,
    methods: ["GET"],
    optionsSuccessStatus: 200,
  })
);

app.use("/api/balance", balanceRouter);

// 서버 상태 확인용. Alchemy를 호출하지 않는다.
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 등록되지 않은 경로 요청 처리.
app.use((req, res) => {
  res.status(404).json({ error: "요청한 경로를 찾을 수 없습니다." });
});

// 예상치 못한 에러 처리. 클라이언트에는 일반 메시지만 반환하고 상세는 서버 로그에 남긴다.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]", err);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
});

module.exports = app;
