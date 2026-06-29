import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import analysis
from app.config import configure_langsmith, settings
from app.db.session import init_db
from app.services.storage_service import ensure_storage_dirs

app = FastAPI(
    title="BA Accelerator Backend",
    description="Backend service for parsing BRD documents and orchestrating analysis agents",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(analysis.router)


@app.on_event("startup")
def startup_event():
    configure_langsmith()
    init_db()
    ensure_storage_dirs()

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ba-accelerator-backend"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
