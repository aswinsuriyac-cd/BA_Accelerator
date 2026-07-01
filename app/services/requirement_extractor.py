class RequirementExtractor:

    def extract(self, title: str, text: str):

        result = {
            "title": title,
            "business_objective": "",
            "scope": "",
            "stakeholders": [],
            "functional_requirements": [],
            "non_functional_requirements": [],
            "constraints": [],
            "assumptions": [],
            "dependencies": [],
            "risks": []
        }

        current_section = None

        for line in text.split("\n"):

            line = line.strip()

            if not line:
                continue

            lower = line.lower()

            if "business objective" in lower:

                current_section = "business_objective"
                continue

            if lower == "scope":

                current_section = "scope"
                continue

            if "functional requirements" in lower:

                current_section = "functional_requirements"
                continue

            if "non-functional" in lower:

                current_section = "non_functional_requirements"
                continue

            if "stakeholder" in lower:

                current_section = "stakeholders"
                continue

            if "constraint" in lower:

                current_section = "constraints"
                continue

            if "assumption" in lower:

                current_section = "assumptions"
                continue

            if "dependenc" in lower:

                current_section = "dependencies"
                continue

            if "risk" in lower:

                current_section = "risks"
                continue

            if current_section == "business_objective":
                result["business_objective"] += line + " "

            elif current_section == "scope":
                result["scope"] += line + " "

            elif current_section in [
                "functional_requirements",
                "non_functional_requirements",
                "stakeholders",
                "constraints",
                "assumptions",
                "dependencies",
                "risks"
            ]:
                result[current_section].append(line)

        return result