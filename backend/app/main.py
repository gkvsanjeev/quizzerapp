from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.config import settings
from app.api.routes import attempts, auth, exams, questions, test_papers

app = FastAPI(
    title="QuizzerApp API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(exams.router, prefix="/api/exams", tags=["exams"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(test_papers.router, prefix="/api/test-papers", tags=["test-papers"])
app.include_router(attempts.router, prefix="/api/attempts", tags=["attempts"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# Vercel serverless entry point (Mangum wraps the ASGI app)
handler = Mangum(app, lifespan="off")
