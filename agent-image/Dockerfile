FROM python:3.12-slim AS builder
WORKDIR /build
RUN pip install --no-cache-dir uv==0.5.4
COPY pyproject.toml ./
COPY src ./src
RUN uv sync --no-dev
RUN uv build --wheel

FROM python:3.12-slim
RUN useradd --create-home --shell /bin/bash agent
WORKDIR /app
COPY --from=builder /build/dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl
USER agent
EXPOSE 8080
ENV CLAW_CONFIG_PATH=/etc/claw.json
CMD ["uvicorn", "agent_runtime.main:app", "--host", "0.0.0.0", "--port", "8080"]
