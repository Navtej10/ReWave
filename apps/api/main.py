import os
import re

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import AGENTS

load_dotenv()

app = FastAPI(title="Rewave agents API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(500, "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.")
        _client = Anthropic()
    return _client


class BlipIn(BaseModel):
    id: str
    parentId: str | None = None
    author: str
    text: str


class AgentRequest(BaseModel):
    blips: list[BlipIn]


class AgentResponse(BaseModel):
    text: str
    sources: list[str]  # blip ids cited by the agent


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL}


@app.post("/agents/{agent}", response_model=AgentResponse)
def run_agent(agent: str, req: AgentRequest) -> AgentResponse:
    system = AGENTS.get(agent)
    if system is None:
        raise HTTPException(404, f"Unknown agent '{agent}'. Available: {', '.join(AGENTS)}")
    if not req.blips:
        raise HTTPException(400, "The wave has no blips yet.")

    transcript = "\n".join(
        f"[b:{b.id}] {b.author}{' (reply to ' + b.parentId + ')' if b.parentId else ''}: {b.text}"
        for b in req.blips
    )
    msg = client().messages.create(
        model=MODEL,
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": f"Wave thread:\n{transcript}"}],
    )
    text = "".join(part.text for part in msg.content if part.type == "text")
    known = {b.id for b in req.blips}
    sources = [s for s in dict.fromkeys(re.findall(r"\[b:([^\]]+)\]", text)) if s in known]
    return AgentResponse(text=text, sources=sources)
