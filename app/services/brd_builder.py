from app.models.brd_model import BRDModel


class BRDBuilder:

    def build(self, data):

        return BRDModel(

            title=data["title"],

            project_name=data["title"],

            business_objective=data["business_objective"],

            scope=data["scope"],

            stakeholders=data["stakeholders"],

            functional_requirements=data["functional_requirements"],

            non_functional_requirements=data["non_functional_requirements"],

            constraints=data["constraints"],

            assumptions=data["assumptions"],

            dependencies=data["dependencies"],

            risks=data["risks"]
        )