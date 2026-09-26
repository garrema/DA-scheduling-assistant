"""Validated contract shared conceptually with the Express backend. Times are UTC minutes."""
from pydantic import BaseModel, Field, model_validator

class Window(BaseModel):
    start: int
    end: int

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start:
            raise ValueError("Interval end must be after start")
        return self

class Employee(BaseModel):
    id: str
    name: str
    availability: list[Window] = Field(default_factory=list, max_length=200)
    exceptions: list[Window] = Field(default_factory=list, max_length=100)
    nightPreference: bool = False
    previousNightMinutes: int = Field(default=0, ge=0)

class Shift(Window):
    id: str
    required: int = Field(ge=1, le=10)
    night: bool = False
    assignees: list[str] = Field(default_factory=list)
    locked: bool = False

class Existing(Window):
    employeeId: str

class Rules(BaseModel):
    maxHours: int = Field(default=20, ge=1, le=20)
    targetHours: int = Field(default=10, ge=0, le=20)
    maxContinuousHours: int = Field(default=6, ge=1, le=6)
    minRestHours: int = Field(default=8, ge=1, le=24)

    @model_validator(mode="after")
    def target(self):
        if self.targetHours > self.maxHours:
            raise ValueError("Target cannot exceed maximum")
        return self

class Problem(BaseModel):
    employees: list[Employee] = Field(max_length=150)
    shifts: list[Shift] = Field(max_length=100)
    existing: list[Existing] = Field(default_factory=list, max_length=3000)
    rules: Rules
    weekStart: int
    weekEnd: int

    @model_validator(mode="after")
    def boundaries(self):
        if not 9000 <= self.weekEnd-self.weekStart <= 11000:
            raise ValueError("Expected one local calendar week")
        for objects in (self.employees, self.shifts):
            if len({x.id for x in objects}) != len(objects):
                raise ValueError("Duplicate identifiers")
        for s in self.shifts:
            if not self.weekStart <= s.start < s.end <= self.weekEnd:
                raise ValueError("Shift must be entirely inside selected week; split at week boundary")
        return self
