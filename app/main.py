from fastapi import FastAPI

from app.controllers.import_controller import router as import_router

app = FastAPI(
    title="Jira BRD Importer",
    version="1.0.0"
)

app.include_router(import_router)


@app.get("/")
def home():

    return {
        "message": "Jira BRD Importer API is running."
}


@app.get("/health")
def health():

    return {
        "status": "Healthy"
}