.PHONY: install dev test lint build e2e e2e-api e2e-ui up
install:
	npm install
dev:
	npm run dev
test:
	npm test
lint:
	npm run lint
build:
	npm run build
# 以下需要三个服务已启动（./scripts/dev.sh 或 make up）
e2e:
	npm run e2e
e2e-api:
	npm run e2e:api
e2e-ui:
	npm run e2e:ui
up:
	docker compose up --build
