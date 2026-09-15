ifeq ($(OS),Windows_NT)
PY := backend/.venv/Scripts/python
else
PY := backend/.venv/bin/python
endif

.PHONY: setup seed dev backend web test

setup:
	python -m venv backend/.venv
	$(PY) -m pip install -r backend/requirements.txt
	cd web && npm install
	cd backend && $(abspath $(PY)) manage.py migrate

seed:
	cd backend && $(abspath $(PY)) manage.py seed_sea --clear

backend:
	cd backend && $(abspath $(PY)) manage.py runserver 127.0.0.1:8000

web:
	cd web && npm run dev

# Both servers, stopped together with Ctrl+C.
dev:
	@echo "backend  http://127.0.0.1:8000"
	@echo "web      http://localhost:3000"
	@$(MAKE) -j2 backend web

test:
	cd backend && $(abspath $(PY)) manage.py test sea
	cd web && npx tsc --noEmit && npm run lint
