import json
import os
from dataclasses import dataclass, field

from llm import Model

TOOLS = {}


def tool(function):
    """Registers a function as a tool the model may call."""
    TOOLS[function.__name__] = function
    return function


@tool
def list_files(folder: str) -> list[str]:
    return sorted(os.listdir(folder))


@tool
def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as source_file:
        return source_file.read()


@dataclass
class Agent:
    model: Model
    history: list[dict] = field(default_factory=list)

    def ask(self, question: str) -> str:
        self.history.append({"role": "user", "content": question})
        while True:
            reply = self.model.complete(self.history, tools=list(TOOLS))
            self.history.append(reply.message)
            if not reply.tool_calls:
                return reply.text
            for call in reply.tool_calls:
                output = TOOLS[call.name](**call.arguments)
                self.history.append(
                    {"role": "tool", "id": call.id, "content": json.dumps(output)}
                )


if __name__ == "__main__":
    agent = Agent(model=Model.from_environment())
    print(agent.ask("Which files are in the examples folder?"))
