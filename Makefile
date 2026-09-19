.PHONY: install dev test lint build e2e e2e-api e2e-ui up
install:
	npm install
dev:
	npm run dev
test:
	npm test
	bash deploy/preview-lib.test.sh
lint:
	npm run lint
build:
	npm run build
# The targets below require the services to be running (./scripts/dev.sh or make up)
e2e:
	npm run e2e
e2e-api:
	npm run e2e:api
e2e-ui:
	npm run e2e:ui
up:
	docker compose up --build
